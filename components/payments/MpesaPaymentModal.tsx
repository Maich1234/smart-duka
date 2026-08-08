import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from 'react-native';
import { useAlert } from '@/context/AlertContext';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { haptics } from '@/utils/haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Button } from '@/components/ui/Button';
import { formatCurrency , formatKenyanPhone } from '@/utils/formatters';
import { randomUUID } from '@/utils/uuid';
import { initiateSTKPush, getTransactionStatus, verifyByReceiptNumber, type MpesaTransactionStatus } from '@/services/mpesa';

interface Props {
  visible: boolean;
  phoneNumber: string;
  amount: number;
  accountReference?: string;
  onSuccess: (transactionId: string | null, mpesaReceiptNumber: string | null) => void;
  onCancel: () => void;
  currency?: string;
  /**
   * Fires once the STK push has been accepted and is awaiting the customer —
   * the caller's cue to persist enough to recover this transaction if the app
   * is backgrounded and killed before it resolves. Not called in resume mode
   * (the caller already has a record; this would just overwrite its
   * `saleItems` snapshot with whatever's in the cart *now*).
   */
  onInitiated?: (transactionId: string) => void;
  /**
   * Skips sending a new STK push and polls this existing transaction instead
   * — for reopening the modal against a payment recovered from a previous
   * app session. Never fire a second STK push for the same sale.
   */
  resumeTransactionId?: string;
  /**
   * Fires once, the moment polling independently determines the transaction
   * is dead (`failed`/`cancelled`/`timeout`) — not just when the cashier
   * dismisses that screen. Closing this modal (onCancel) unmounts it, which
   * stops polling entirely; without this, a payment the cashier cancelled on
   * while it was still genuinely pending would leave the caller's persisted
   * record dangling with nothing to distinguish "still open" from "already
   * resolved." Never fires for `success` — that has its own explicit
   * `onSuccess`, tied to the cashier confirming the sale.
   */
  onResolved?: (status: 'failed' | 'cancelled' | 'timeout') => void;
}

type ModalStatus = 'initiating' | 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 120000; // 120 seconds
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Thin gate. The body below is mounted only while the modal is open, so every
 * payment intent starts from freshly-initialised state — this replaced an
 * effect that reset eight fields by hand on `visible` to stop the previous
 * payment's terminal status flashing before the new STK push began.
 */
export const MpesaPaymentModal: React.FC<Props> = ({ visible, ...rest }) =>
  visible ? <MpesaPaymentModalBody {...rest} /> : null;

const MpesaPaymentModalBody: React.FC<Omit<Props, 'visible'>> = ({
  phoneNumber,
  amount,
  accountReference,
  onSuccess,
  onCancel,
  currency = 'KES',
  onInitiated,
  resumeTransactionId,
  onResolved,
}) => {
  const { toast } = useAlert();
  const [status, setStatus] = useState<ModalStatus>(resumeTransactionId ? 'pending' : 'initiating');
  const [transactionId, setTransactionId] = useState<string | null>(resumeTransactionId ?? null);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOfflineEntry, setIsOfflineEntry] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Verify-by-receipt-code UI state
  const [showVerifyInput, setShowVerifyInput] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const consecutiveErrorsRef = useRef(0);

  /**
   * Idempotency key: generated ONCE when the modal opens for this payment intent.
   * Stays constant across all retries for this same intent (article principle:
   * "generate at the moment of user confirmation, not at the moment of the network call").
   * Reset to a new value only when the modal closes and reopens (new intent).
   */
  const idempotencyKeyRef = useRef<string>('');

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (status === 'pending') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withSpring(1);
    }
    // pulseScale is a Reanimated shared value — stable, declared for honesty.
  }, [status, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Physical confirmation of payment outcomes — staff feel the result without
  // looking at the screen (busy counter, phone in pocket while bagging goods).
  useEffect(() => {
    if (status === 'success') haptics.success();
    else if (status === 'failed') haptics.error();
    else if (status === 'cancelled' || status === 'timeout') haptics.warning();
  }, [status]);

  // Tell the caller the instant polling itself determines this transaction
  // is dead — not only when the cashier acknowledges the screen. The cashier
  // cancelling *before* this fires (while still `pending`) is a distinct,
  // still-open case the caller handles via onCancel instead.
  useEffect(() => {
    if (status === 'failed' || status === 'cancelled' || status === 'timeout') {
      onResolved?.(status);
    }
    // onResolved is a caller-supplied callback, not reactive state this
    // effect should re-run for — only the status transition matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Currently-polled transaction, so an app-resume check (below) can poll the
  // right id without waiting for the next interval tick.
  const activeTxIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    activeTxIdRef.current = null;
  }, []);

  // One status check. Shared by the interval tick and the app-resume handler
  // so backgrounding the app doesn't leave the cashier stuck until the next
  // scheduled tick — iOS/Android both throttle or fully suspend JS timers
  // while backgrounded, so the interval alone can go silent for minutes.
  const checkStatusOnce = useCallback(async (txId: string) => {
    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed > MAX_POLL_DURATION_MS) {
      stopPolling();
      setStatus('timeout');
      return;
    }
    try {
      const res = await getTransactionStatus(txId);
      consecutiveErrorsRef.current = 0;
      const s = res.data.status as MpesaTransactionStatus;
      if (s !== 'pending') {
        stopPolling();
        if (s === 'success') {
          setReceiptNumber(res.data.mpesaReceiptNumber);
          setStatus('success');
        } else if (s === 'cancelled') {
          setStatus('cancelled');
        } else if (s === 'timeout') {
          setStatus('timeout');
        } else {
          setErrorMessage(res.data.errorMessage ?? 'Payment was not completed.');
          setStatus('failed');
        }
      }
    } catch (err: any) {
      // Distinguish transient network jitter from persistent server errors.
      // After MAX_CONSECUTIVE_ERRORS back-to-back failures we surface an error
      // rather than leaving staff waiting for the full 120s countdown.
      const isNetworkError = !err?.response;
      if (!isNetworkError) {
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
          stopPolling();
          setErrorMessage(err.response?.data?.message ?? 'Unable to reach payment server. Check your connection.');
          setStatus('failed');
        }
      }
      // Pure network jitter — keep polling silently.
    }
  }, [stopPolling]);

  const beginPolling = useCallback((txId: string) => {
    stopPolling();
    consecutiveErrorsRef.current = 0;
    activeTxIdRef.current = txId;

    // Live countdown so staff know how long is left.
    const totalSeconds = Math.round(MAX_POLL_DURATION_MS / 1000);
    setCountdown(totalSeconds);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    pollRef.current = setInterval(() => { checkStatusOnce(txId); }, POLL_INTERVAL_MS);
  }, [stopPolling, checkStatusOnce]);

  // Backgrounding suspends/throttles the interval above; resuming should
  // re-sync immediately rather than leaving a stale "waiting" screen up for
  // however long is left on the throttled tick. The transaction itself lives
  // on the server (keyed by activeTxIdRef, not component state), so this is
  // a plain re-check, never a new STK push.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && activeTxIdRef.current && pollRef.current) {
        checkStatusOnce(activeTxIdRef.current);
        // Also re-sync the visible countdown against wall-clock time so it
        // doesn't sit frozen at the value it had when the app backgrounded.
        const remaining = Math.max(
          0,
          Math.round((MAX_POLL_DURATION_MS - (Date.now() - startTimeRef.current)) / 1000)
        );
        setCountdown(remaining);
      }
    });
    return () => sub.remove();
  }, [checkStatusOnce]);

  const sendSTKPush = useCallback(async (key: string) => {
    setStatus('initiating');
    setTransactionId(null);
    setReceiptNumber(null);
    setErrorMessage(null);
    setIsOfflineEntry(false);
    setShowVerifyInput(false);
    setVerifyCode('');
    setCountdown(0);
    consecutiveErrorsRef.current = 0;

    try {
      const res = await initiateSTKPush(phoneNumber, amount, accountReference, key);
      setTransactionId(res.data.transactionId);

      // If the server returned a cached idempotent result that's already resolved, surface it
      if (res.idempotent && res.data.status !== 'pending') {
        const s = res.data.status as MpesaTransactionStatus;
        if (s === 'success') {
          setReceiptNumber((res.data as any).mpesaReceiptNumber ?? null);
          setStatus('success');
        } else if (s === 'cancelled') {
          setStatus('cancelled');
        } else if (s === 'timeout') {
          setStatus('timeout');
        } else {
          setErrorMessage((res.data as any).errorMessage ?? 'Payment was not completed.');
          setStatus('failed');
        }
        return;
      }

      setStatus('pending');
      startTimeRef.current = Date.now();
      onInitiated?.(res.data.transactionId);
      beginPolling(res.data.transactionId);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to send payment request');
      setStatus('failed');
    }
  }, [phoneNumber, amount, accountReference, beginPolling, onInitiated]);

  // Start the STK Push on mount, unless reopening against an already-sent
  // one — mounting *is* the open, and every field above is already at its
  // initial value, so there is nothing to reset first.
  useEffect(() => {
    if (resumeTransactionId) {
      // Re-check immediately rather than waiting out the first poll interval
      // — this mount likely *is* the cashier asking "did it go through?"
      // after a recovered payment banner. `transactionId` and `status` are
      // already initialised above for this case. Both calls below set state
      // synchronously (checkStatusOnce on its stale-timeout path, beginPolling
      // via its countdown seed), so both are deferred a macrotask — same
      // pattern as useShiftClock's kickoff in ShiftGate.tsx — to keep them
      // out of the effect's own synchronous pass.
      startTimeRef.current = Date.now();
      setTimeout(() => {
        checkStatusOnce(resumeTransactionId);
        beginPolling(resumeTransactionId);
      }, 0);
    } else {
      // New payment intent → new idempotency key
      idempotencyKeyRef.current = randomUUID();
      sendSTKPush(idempotencyKeyRef.current);
    }

    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Retry: reuses the SAME idempotency key so the server knows this is a retry
   * of the same payment intent — not a new one. A resumed modal never sent
   * its own STK push, so it has no key yet; a retry from there is genuinely
   * a fresh attempt and needs one minted now.
   */
  const handleRetry = () => {
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = randomUUID();
    sendSTKPush(idempotencyKeyRef.current);
  };

  /**
   * Verify by M-Pesa receipt code — for when the 90s window expired but the
   * customer's phone shows a success SMS (e.g. "Confirmed. Ksh200 sent to…").
   * The cashier can type in the code (like QGR12345XY) to confirm on our end.
   */
  const handleVerifyReceipt = async () => {
    const code = verifyCode.trim().toUpperCase();
    if (code.length < 6) {
      toast({ type: 'error', message: 'Enter the full M-Pesa transaction code from the customer\'s SMS.' });
      return;
    }
    setVerifying(true);
    try {
      const res = await verifyByReceiptNumber(code);
      if (res.data.status === 'success') {
        setReceiptNumber(res.data.mpesaReceiptNumber);
        setTransactionId(res.data.transactionId);
        setIsOfflineEntry(false);
        setStatus('success');
      } else {
        toast({
          type: 'warning',
          message: `Transaction found but status is "${res.data.status}". ${res.message}`,
        });
      }
    } catch (err: any) {
      // Offline — trust the code the staff entered from the customer's SMS.
      // The sale will be queued and synced when connectivity returns.
      if (err?.offlineRealtime || err?.offlineQueued) {
        setReceiptNumber(code);
        setTransactionId(null);
        setIsOfflineEntry(true);
        setStatus('success');
        return;
      }
      const msg = err.response?.data?.message || 'Receipt code not found. Double-check the code and try again.';
      toast({ type: 'error', message: msg });
    } finally {
      setVerifying(false);
    }
  };

  const handleSuccess = () => {
    onSuccess(transactionId, receiptNumber);
  };

  const maskedPhone = formatKenyanPhone(phoneNumber);
  const isTerminal = status === 'failed' || status === 'cancelled' || status === 'timeout';

  return (
    // The backdrop fades and the sheet springs as siblings, not one inside the
    // other: an `entering` nested under another `entering` can be left stranded
    // at its start values, and here that would strand the sheet's contents.
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable
          style={styles.backdrop}
          onPress={status === 'pending' || status === 'initiating' ? undefined : onCancel}
        />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrap}
      >
        <Animated.View entering={FadeInDown.springify().damping(20).stiffness(200)} style={styles.sheet}>
          <View style={styles.handle} />

          {/* Initiating */}
          {status === 'initiating' && (
            <Animated.View entering={FadeIn} style={styles.body}>
              <View style={styles.iconWrap}>
                <LinearGradient colors={['#0F766E', '#14B8A6']} style={styles.iconGradient}>
                  <Ionicons name="phone-portrait-outline" size={28} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.statusTitle}>Sending Request...</Text>
              <Text style={styles.statusSub}>
                Initiating M-Pesa payment of {formatCurrency(amount, currency)} to {maskedPhone}
              </Text>
            </Animated.View>
          )}

          {/* Pending — waiting for customer PIN */}
          {status === 'pending' && (
            <Animated.View entering={FadeIn} style={styles.body}>
              <Animated.View style={[styles.iconWrap, pulseStyle]}>
                <LinearGradient colors={['#0F766E', '#14B8A6']} style={styles.iconGradient}>
                  <Ionicons name="phone-portrait" size={28} color="#fff" />
                </LinearGradient>
              </Animated.View>
              <View style={[styles.statusBadge, styles.pendingBadge]}>
                <Ionicons name="time-outline" size={12} color="#92400E" />
                <Text style={[styles.statusBadgeText, { color: '#92400E' }]}>Waiting for customer</Text>
              </View>
              <Text style={styles.statusTitle}>Payment Request Sent</Text>
              <Text style={styles.statusSub}>
                An M-Pesa prompt has been sent to{'\n'}
                <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
                {'\n'}Ask the customer to enter their M-Pesa PIN.
              </Text>
              <View style={styles.amountCard}>
                <Text style={styles.amountLabel}>Amount</Text>
                <Text style={styles.amountValue}>{formatCurrency(amount, currency)}</Text>
              </View>
              <View style={styles.waitingDots}>
                <WaitingDots />
              </View>
              {countdown > 0 && (
                <Text style={styles.countdownText}>
                  Waiting {countdown}s…
                </Text>
              )}
              <AnimatedPressable onPress={onCancel} style={styles.cancelLink}>
                <Text style={styles.cancelLinkText}>Cancel transaction</Text>
              </AnimatedPressable>
            </Animated.View>
          )}

          {/* Success */}
          {status === 'success' && (
            <Animated.View entering={FadeInDown.duration(340)} style={styles.body}>
              <LinearGradient
                colors={isOfflineEntry ? ['#0F766E', '#14B8A6'] : ['#15803D', '#16A34A']}
                style={styles.successIcon}
              >
                <Ionicons name={isOfflineEntry ? 'cloud-upload-outline' : 'checkmark'} size={36} color="#fff" />
              </LinearGradient>
              <View style={[styles.statusBadge, isOfflineEntry ? styles.pendingBadge : styles.successBadge]}>
                <Ionicons
                  name={isOfflineEntry ? 'time-outline' : 'checkmark-circle'}
                  size={12}
                  color={isOfflineEntry ? '#92400E' : Colors.success}
                />
                <Text style={[styles.statusBadgeText, { color: isOfflineEntry ? '#92400E' : Colors.success }]}>
                  {isOfflineEntry ? 'Saved — will sync when online' : 'Payment Confirmed'}
                </Text>
              </View>
              <Text style={styles.statusTitle}>
                {isOfflineEntry ? 'Sale Recorded Offline' : 'Payment Successful'}
              </Text>
              <Text style={styles.statusSub}>
                {isOfflineEntry
                  ? `${formatCurrency(amount, currency)} from ${maskedPhone} — receipt code saved. Sale will sync automatically when connected.`
                  : `${formatCurrency(amount, currency)} received from ${maskedPhone}`}
              </Text>
              {receiptNumber && (
                <View style={[styles.receiptCard, isOfflineEntry && styles.receiptCardOffline]}>
                  <Text style={[styles.receiptLabel, isOfflineEntry && styles.receiptLabelOffline]}>
                    M-Pesa Reference
                  </Text>
                  <Text style={[styles.receiptNumber, isOfflineEntry && styles.receiptNumberOffline]}>
                    {receiptNumber}
                  </Text>
                </View>
              )}
              <Button
                title="Complete Sale"
                leftIcon="checkmark-circle-outline"
                onPress={handleSuccess}
                style={styles.actionBtn}
              />
            </Animated.View>
          )}

          {/* Failed / Cancelled / Timeout */}
          {isTerminal && (
            <Animated.View entering={FadeInDown.duration(340)} style={styles.body}>
              <View style={[styles.iconWrap, styles.failedIcon]}>
                <Ionicons
                  name={status === 'cancelled' ? 'close-circle' : status === 'timeout' ? 'time' : 'alert-circle'}
                  size={36}
                  color={Colors.danger}
                />
              </View>
              <View style={[styles.statusBadge, styles.failedBadge]}>
                <Text style={[styles.statusBadgeText, { color: Colors.danger }]}>
                  {status === 'cancelled' ? 'Payment Cancelled' : status === 'timeout' ? 'Request Timed Out' : 'Payment Failed'}
                </Text>
              </View>
              <Text style={styles.statusTitle}>
                {status === 'cancelled' ? 'Customer Cancelled'
                  : status === 'timeout' ? 'No Response'
                  : 'Payment Not Completed'}
              </Text>
              <Text style={styles.statusSub}>
                {errorMessage
                  || (status === 'cancelled' ? 'The customer dismissed the M-Pesa prompt.'
                    : status === 'timeout' ? 'The customer did not respond in time.'
                    : 'The payment could not be processed.')}
              </Text>

              {/* ── Retry / Cancel row ─────────────────────────────────────── */}
              <View style={styles.retryRow}>
                <Button
                  title="Try Again"
                  leftIcon="refresh-outline"
                  onPress={handleRetry}
                  style={styles.retryBtn}
                />
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={onCancel}
                  style={styles.retryBtn}
                />
              </View>

              {/* ── Verify with M-Pesa code section ───────────────────────── */}
              <AnimatedPressable
                style={styles.verifyToggle}
                onPress={() => setShowVerifyInput((v) => !v)}
              >
                <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primary} />
                <Text style={styles.verifyToggleText}>
                  {showVerifyInput ? 'Hide verification' : 'Customer already paid? Verify with M-Pesa code'}
                </Text>
              </AnimatedPressable>

              {showVerifyInput && (
                <Animated.View entering={FadeInDown.duration(220)} style={styles.verifyBox}>
                  <Text style={styles.verifyBoxTitle}>Enter M-Pesa Transaction Code</Text>
                  <Text style={styles.verifyBoxSub}>
                    Ask the customer to show their M-Pesa confirmation SMS.{'\n'}
                    Enter the code (e.g. QGR12345XY) to confirm payment.
                  </Text>
                  <View style={styles.verifyInputRow}>
                    <TextInput
                      style={styles.verifyInput}
                      value={verifyCode}
                      onChangeText={(t) => setVerifyCode(t.toUpperCase())}
                      placeholder="e.g. QGR12345XY"
                      placeholderTextColor={Colors.textTertiary}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={20}
                      returnKeyType="done"
                      onSubmitEditing={handleVerifyReceipt}
                    />
                    <Button
                      title={verifying ? '...' : 'Verify'}
                      onPress={handleVerifyReceipt}
                      loading={verifying}
                      disabled={verifyCode.trim().length < 6 || verifying}
                      size="sm"
                      style={styles.verifyBtn}
                    />
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Waiting dots animation ───────────────────────────────────────────────────

const WaitingDot: React.FC<{ delay: number }> = ({ delay }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1,
        false
      );
    }, delay);
    return () => {
      clearTimeout(timer);
      // Cancel any in-flight animation so we don't update state on
      // an unmounted component when the modal closes during the delay window.
      cancelAnimation(opacity);
    };
  }, [delay, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, animStyle]} />;
};

const WaitingDots: React.FC = () => (
  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
    <WaitingDot delay={0} />
    <WaitingDot delay={160} />
    <WaitingDot delay={320} />
  </View>
);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  sheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 8,
  },
  iconWrap: {
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  failedIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.dangerSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  pendingBadge: { backgroundColor: Colors.warningSubtle },
  successBadge: { backgroundColor: Colors.successSubtle },
  failedBadge: { backgroundColor: Colors.dangerSubtle },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
  },
  statusTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  statusSub: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  phoneHighlight: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  amountCard: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
  },
  amountLabel: {
    fontSize: 11,
    color: Colors.primary,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 22,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  waitingDots: { marginBottom: 6 },
  countdownText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  cancelLink: { paddingVertical: 8 },
  cancelLinkText: {
    fontSize: Typography.size.small,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
    textDecorationLine: 'underline',
  },
  receiptCard: {
    backgroundColor: Colors.successSubtle,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${Colors.success}30`,
    width: '100%',
  },
  receiptLabel: {
    fontSize: 11,
    color: Colors.success,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  receiptNumber: {
    fontSize: 18,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.success,
    letterSpacing: 1,
  },
  actionBtn: { width: '100%' },
  retryRow: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  retryBtn: { flex: 1 },

  // Verify with receipt code
  verifyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  verifyToggleText: {
    fontSize: 12,
    color: Colors.primary,
    fontFamily: Typography.fontFamilySemiBold,
    textDecorationLine: 'underline',
  },
  verifyBox: {
    width: '100%',
    backgroundColor: Colors.primarySubtle,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.primary}20`,
    marginBottom: 8,
  },
  verifyBoxTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  verifyBoxSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  verifyInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  verifyInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    letterSpacing: 1.5,
  },
  verifyBtn: { minWidth: 72 },

  // Offline receipt entry variants
  receiptCardOffline: {
    backgroundColor: Colors.warningSubtle,
    borderColor: `${Colors.warning}30`,
  },
  receiptLabelOffline: { color: Colors.warning },
  receiptNumberOffline: { color: '#92400E' },
});
