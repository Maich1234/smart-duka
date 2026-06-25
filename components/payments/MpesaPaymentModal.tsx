import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/utils/formatters';
import { initiateSTKPush, getTransactionStatus, verifyByReceiptNumber, type MpesaTransactionStatus } from '@/services/mpesa';

interface Props {
  visible: boolean;
  phoneNumber: string;
  amount: number;
  accountReference?: string;
  onSuccess: (transactionId: string, mpesaReceiptNumber: string) => void;
  onCancel: () => void;
  currency?: string;
}

type ModalStatus = 'initiating' | 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 90000; // 90 seconds

/** UUID v4 generator — uses crypto.randomUUID when available (Hermes/modern), falls back gracefully. */
function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const MpesaPaymentModal: React.FC<Props> = ({
  visible,
  phoneNumber,
  amount,
  accountReference,
  onSuccess,
  onCancel,
  currency = 'KES',
}) => {
  const [status, setStatus] = useState<ModalStatus>('initiating');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Verify-by-receipt-code UI state
  const [showVerifyInput, setShowVerifyInput] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

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
  }, [status]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const beginPolling = useCallback((txId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > MAX_POLL_DURATION_MS) {
        stopPolling();
        setStatus('timeout');
        return;
      }
      try {
        const res = await getTransactionStatus(txId);
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
      } catch {
        // Network hiccup during polling — keep trying
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  const sendSTKPush = useCallback(async (key: string) => {
    setStatus('initiating');
    setTransactionId(null);
    setReceiptNumber(null);
    setErrorMessage(null);
    setShowVerifyInput(false);
    setVerifyCode('');

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
      beginPolling(res.data.transactionId);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to send payment request');
      setStatus('failed');
    }
  }, [phoneNumber, amount, accountReference, beginPolling]);

  // Start the STK Push when the modal opens — generate a fresh idempotency key for this intent
  useEffect(() => {
    if (!visible) {
      stopPolling();
      return;
    }
    // New payment intent → new idempotency key
    idempotencyKeyRef.current = generateIdempotencyKey();
    sendSTKPush(idempotencyKeyRef.current);

    return () => {
      stopPolling();
    };
  }, [visible]);

  /**
   * Retry: reuses the SAME idempotency key so the server knows this is a retry
   * of the same payment intent — not a new one.
   */
  const handleRetry = () => {
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
      Alert.alert('Invalid Code', 'Enter the full M-Pesa transaction code from the customer\'s SMS.');
      return;
    }
    setVerifying(true);
    try {
      const res = await verifyByReceiptNumber(code);
      if (res.data.status === 'success') {
        setReceiptNumber(res.data.mpesaReceiptNumber);
        setTransactionId(res.data.transactionId);
        setStatus('success');
      } else {
        Alert.alert(
          'Payment Not Confirmed',
          `Transaction found but status is "${res.data.status}". ${res.message}`
        );
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Receipt code not found. Double-check the code and try again.';
      Alert.alert('Verification Failed', msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleSuccess = () => {
    onSuccess(transactionId!, receiptNumber!);
  };

  if (!visible) return null;

  const maskedPhone = formatPhone(phoneNumber);
  const isTerminal = status === 'failed' || status === 'cancelled' || status === 'timeout';

  return (
    <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={status === 'pending' || status === 'initiating' ? undefined : onCancel}
      />
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
              <TouchableOpacity onPress={onCancel} style={styles.cancelLink}>
                <Text style={styles.cancelLinkText}>Cancel transaction</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Success */}
          {status === 'success' && (
            <Animated.View entering={FadeInDown.duration(340)} style={styles.body}>
              <LinearGradient colors={['#15803D', '#16A34A']} style={styles.successIcon}>
                <Ionicons name="checkmark" size={36} color="#fff" />
              </LinearGradient>
              <View style={[styles.statusBadge, styles.successBadge]}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={[styles.statusBadgeText, { color: Colors.success }]}>Payment Confirmed</Text>
              </View>
              <Text style={styles.statusTitle}>Payment Successful</Text>
              <Text style={styles.statusSub}>
                {formatCurrency(amount, currency)} received from {maskedPhone}
              </Text>
              {receiptNumber && (
                <View style={styles.receiptCard}>
                  <Text style={styles.receiptLabel}>M-Pesa Reference</Text>
                  <Text style={styles.receiptNumber}>{receiptNumber}</Text>
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
              <TouchableOpacity
                style={styles.verifyToggle}
                onPress={() => setShowVerifyInput((v) => !v)}
              >
                <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primary} />
                <Text style={styles.verifyToggleText}>
                  {showVerifyInput ? 'Hide verification' : 'Customer already paid? Verify with M-Pesa code'}
                </Text>
              </TouchableOpacity>

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
    </Animated.View>
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
    return () => clearTimeout(timer);
  }, []);

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

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `0${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
  waitingDots: { marginBottom: 16 },
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
});
