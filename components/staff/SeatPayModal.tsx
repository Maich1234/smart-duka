import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';
import { randomUUID } from '@/utils/uuid';
import { useAuthStore } from '@/store/authStore';
import { isSystemGeneratedEmail } from '@/utils/staffEmailSlug';
import {
  initiateSeatPayment,
  getSeatPaymentStatus,
  recheckSeatPayment,
  reconcileSeatPaymentByMessage,
  type CreateStaffData,
  type Staff,
  type SeatPaymentStatus,
} from '@/services/staff';

type Stage = 'input' | 'initiating' | 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout';

interface SeatPayModalProps {
  visible: boolean;
  amount: number;
  currency: string;
  staffDraft: CreateStaffData;
  /** Prefill — the owner usually pays with their own line. */
  defaultPhone?: string;
  onClose: () => void;
  /** Called once the staff member has actually been created (paid, or free if the seat opened up). */
  onSuccess: (staff: Staff) => void;
}

const POLL_INTERVAL_MS = 3500;
const POLL_TIMEOUT_MS = 120_000;

/**
 * Owner-facing M-PESA STK Push flow for buying one additional staff seat —
 * cloned from SubscriptionPayModal's skeleton, trimmed of promo-code UI. The
 * amount is displayed but never sent — the server recomputes it, and if the
 * seat turns out to already be covered by the time this runs (e.g. someone
 * else was just removed), creates the staff directly with no charge at all.
 */
export const SeatPayModal: React.FC<SeatPayModalProps> = ({
  visible,
  amount,
  currency,
  staffDraft,
  defaultPhone,
  onClose,
  onSuccess,
}) => {
  const shopName = useAuthStore((s) => s.user?.shop?.name) ?? '';
  const canSignInImmediately = isSystemGeneratedEmail(staffDraft.email, shopName);
  const [stage, setStage] = useState<Stage>('input');
  const [digits, setDigits] = useState(() => (defaultPhone ?? '').replace(/^\+?254/, '').replace(/\D/g, '').slice(0, 9));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [showPasteSheet, setShowPasteSheet] = useState(false);
  const [pastedMessage, setPastedMessage] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [verifyingPaste, setVerifyingPaste] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const createdStaffRef = useRef<Staff | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  // Every exit path resets the flow so the next open starts clean.
  const reset = () => {
    stopPolling();
    setStage('input');
    setErrorMessage(null);
    setReceipt(null);
    setPaymentId(null);
    setRechecking(false);
    setShowPasteSheet(false);
    setPastedMessage('');
    setPasteError(null);
    setVerifyingPaste(false);
    createdStaffRef.current = null;
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const handleSuccess = () => {
    const staff = createdStaffRef.current;
    reset();
    if (staff) onSuccess(staff);
  };

  useEffect(() => {
    if (stage === 'success') haptics.success();
    else if (stage === 'failed') haptics.error();
    else if (stage === 'cancelled' || stage === 'timeout') haptics.warning();
  }, [stage]);

  const phoneValid = /^[17]\d{8}$/.test(digits);

  const startPolling = (id: string) => {
    startedAtRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) {
        stopPolling();
        setStage('timeout');
        setErrorMessage('The payment request expired before it was confirmed.');
        return;
      }
      try {
        const res = await getSeatPaymentStatus(id);
        const { status, receipt: rcpt, errorMessage: err, staff } = res.data;
        if (status === 'pending') return;
        stopPolling();
        setReceipt(rcpt);
        setErrorMessage(err);
        if (staff) createdStaffRef.current = staff;
        setStage(status);
      } catch {
        // Network jitter — keep polling silently until the timeout.
      }
    }, POLL_INTERVAL_MS);
  };

  const pay = async () => {
    if (!phoneValid) return;
    haptics.medium();
    setStage('initiating');
    setErrorMessage(null);
    try {
      const res = await initiateSeatPayment(
        { ...staffDraft, phoneNumber: `+254${digits}` },
        randomUUID()
      );
      if (res.data.mode === 'created') {
        // The seat was free by the time this ran — no charge needed.
        createdStaffRef.current = res.data.staff;
        setStage('success');
        return;
      }
      setPaymentId(res.data.paymentId);
      setStage('pending');
      startPolling(res.data.paymentId);
    } catch (err: any) {
      setStage('failed');
      setErrorMessage(err?.response?.data?.message ?? 'Could not start the payment. Check your connection and try again.');
    }
  };

  const applyResult = (result: { status: SeatPaymentStatus; receipt: string | null; errorMessage: string | null; staff: Staff | null }) => {
    if (result.status === 'pending') return false;
    setReceipt(result.receipt);
    setErrorMessage(result.errorMessage);
    if (result.staff) createdStaffRef.current = result.staff;
    setStage(result.status);
    return result.status === 'success';
  };

  /** "I definitely paid, check again" — re-verifies this exact attempt directly with M-PESA. */
  const handleRecheck = async () => {
    if (!paymentId || rechecking) return;
    haptics.light();
    setRechecking(true);
    try {
      const res = await recheckSeatPayment(paymentId);
      const becameSuccess = applyResult(res.data);
      if (!becameSuccess) {
        setErrorMessage(res.data.errorMessage ?? "We checked with M-PESA but this payment isn't confirmed yet. Try again in a minute.");
      }
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message ?? 'Could not recheck the payment. Try again shortly.');
    } finally {
      setRechecking(false);
    }
  };

  /** Recovery path when there's no live paymentId to recheck (e.g. reopened after closing the app). */
  const handleVerifyPastedMessage = async () => {
    const text = pastedMessage.trim();
    if (!text || verifyingPaste) return;
    haptics.light();
    setVerifyingPaste(true);
    setPasteError(null);
    try {
      const res = await reconcileSeatPaymentByMessage(text);
      setShowPasteSheet(false);
      const becameSuccess = applyResult(res.data);
      if (!becameSuccess) setErrorMessage(res.message);
    } catch (err: any) {
      setPasteError(err?.response?.data?.message ?? "Couldn't verify that message. Check it's the full M-PESA SMS and try again.");
    } finally {
      setVerifyingPaste(false);
    }
  };

  if (!visible) return null;

  const isBusy = stage === 'initiating' || stage === 'pending';
  const isTerminalFailure = stage === 'failed' || stage === 'cancelled' || stage === 'timeout';

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, styles.root]}>
      <Pressable style={styles.backdrop} onPress={isBusy ? undefined : handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <Animated.View entering={FadeInDown.springify().damping(20).stiffness(200)} style={styles.sheet}>
          <View style={styles.handle} />

          {stage === 'input' && (
            <Animated.View entering={FadeIn} style={styles.body}>
              <View style={styles.iconWrap}>
                <LinearGradient colors={['#0F766E', '#14B8A6']} style={styles.iconGradient}>
                  <Ionicons name="person-add-outline" size={26} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Pay for new seat</Text>
              <Text style={styles.sub}>
                Adding {staffDraft.name || 'this team member'} raises your bill. We’ll send a payment prompt of{' '}
                <Text style={styles.emph}>{formatCurrency(amount, currency)}</Text> to your phone.
              </Text>

              <View style={styles.phoneRow}>
                <View style={styles.prefixBox}>
                  <Text style={styles.prefixText}>+254</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={digits}
                  onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 9))}
                  placeholder="712345678"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={9}
                  autoFocus
                  accessibilityLabel="M-PESA phone number"
                />
              </View>

              <Button
                title={`Pay ${formatCurrency(amount, currency)}`}
                onPress={pay}
                disabled={!phoneValid}
                style={{ alignSelf: 'stretch', marginTop: Spacing.md }}
              />
              <AnimatedPressable onPress={handleClose} style={styles.cancelLink} accessibilityRole="button">
                <Text style={styles.cancelLinkText}>Not now</Text>
              </AnimatedPressable>
            </Animated.View>
          )}

          {(stage === 'initiating' || stage === 'pending') && (
            <Animated.View entering={FadeIn} style={styles.body}>
              <View style={styles.iconWrap}>
                <LinearGradient colors={['#0F766E', '#14B8A6']} style={styles.iconGradient}>
                  <Ionicons name="phone-portrait" size={26} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>
                {stage === 'initiating' ? 'Sending request…' : 'Check your phone'}
              </Text>
              <Text style={styles.sub}>
                {stage === 'initiating'
                  ? `Starting an M-PESA payment of ${formatCurrency(amount, currency)}.`
                  : `Enter your M-PESA PIN on +254${digits} to pay ${formatCurrency(amount, currency)}.`}
              </Text>
            </Animated.View>
          )}

          {stage === 'success' && (
            <Animated.View entering={FadeInDown.duration(340)} style={styles.body}>
              <LinearGradient colors={['#15803D', '#16A34A']} style={styles.iconGradient}>
                <Ionicons name="checkmark" size={32} color="#fff" />
              </LinearGradient>
              <Text style={styles.title}>Staff member added</Text>
              <Text style={styles.sub}>
                {paymentId
                  ? `${formatCurrency(amount, currency)} paid${receipt ? ` · Receipt ${receipt}` : ''}.\n`
                  : 'No extra charge — this seat was already covered.\n'}
                {canSignInImmediately
                  ? `${staffDraft.name || 'They'} can now sign in.`
                  : `${staffDraft.name || 'They'} can verify their email to sign in.`}
              </Text>
              <Button title="Done" onPress={handleSuccess} style={{ alignSelf: 'stretch' }} />
            </Animated.View>
          )}

          {isTerminalFailure && (
            <Animated.View entering={FadeIn} style={styles.body}>
              <View style={[styles.iconGradient, styles.failIcon]}>
                <Ionicons
                  name={stage === 'cancelled' ? 'close-circle' : stage === 'timeout' ? 'time' : 'alert-circle'}
                  size={30}
                  color={Colors.danger}
                />
              </View>
              <Text style={styles.title}>
                {stage === 'cancelled' ? 'Payment cancelled' : stage === 'timeout' ? 'Request timed out' : 'Payment failed'}
              </Text>
              <Text style={styles.sub}>
                {errorMessage
                  ?? (stage === 'cancelled'
                    ? 'The M-PESA prompt was dismissed.'
                    : 'The payment did not go through. No money was taken, and the staff member was not added.')}
              </Text>

              {paymentId && (
                <Button
                  title="I already paid — recheck"
                  onPress={handleRecheck}
                  loading={rechecking}
                  style={{ alignSelf: 'stretch', marginBottom: Spacing.sm }}
                />
              )}

              {showPasteSheet ? (
                <View style={styles.pasteSheet}>
                  <Text style={styles.pasteLabel}>Paste the M-PESA confirmation SMS</Text>
                  <TextInput
                    style={styles.pasteInput}
                    value={pastedMessage}
                    onChangeText={(t) => {
                      setPastedMessage(t);
                      if (pasteError) setPasteError(null);
                    }}
                    placeholder="QGH7XXXXX Confirmed. Ksh500.00 sent to..."
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    numberOfLines={3}
                    accessibilityLabel="M-PESA confirmation message"
                  />
                  {!!pasteError && <Text style={styles.inlineErrorText}>{pasteError}</Text>}
                  <Button
                    title="Verify payment"
                    onPress={handleVerifyPastedMessage}
                    loading={verifyingPaste}
                    disabled={!pastedMessage.trim()}
                    style={{ alignSelf: 'stretch' }}
                  />
                </View>
              ) : (
                <AnimatedPressable onPress={() => setShowPasteSheet(true)} style={styles.pasteLink} accessibilityRole="button">
                  <Ionicons name="chatbox-ellipses-outline" size={14} color={Colors.primary} />
                  <Text style={styles.pasteLinkText}>Paste M-PESA message instead</Text>
                </AnimatedPressable>
              )}

              <AnimatedPressable onPress={() => setStage('input')} style={styles.cancelLink} accessibilityRole="button">
                <Text style={styles.cancelLinkText}>Try a new payment</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={handleClose} style={styles.cancelLink} accessibilityRole="button">
                <Text style={styles.cancelLinkText}>Close</Text>
              </AnimatedPressable>
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { zIndex: 100 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: Spacing.sm,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  iconWrap: { marginBottom: Spacing.sm },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  failIcon: {
    backgroundColor: Colors.dangerSubtle,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  sub: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    lineHeight: Typography.lineHeight.small,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  emph: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamilySemiBold,
  },
  phoneRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  prefixBox: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  prefixText: {
    color: Colors.textPrimary,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.5,
  },
  cancelLink: { marginTop: Spacing.sm, padding: Spacing.sm },
  cancelLinkText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  inlineErrorText: {
    color: Colors.danger,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  pasteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  pasteLinkText: {
    color: Colors.primary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  pasteSheet: {
    alignSelf: 'stretch',
    marginBottom: Spacing.md,
  },
  pasteLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    marginBottom: Spacing.xs,
  },
  pasteInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    textAlignVertical: 'top',
    minHeight: 72,
    marginBottom: Spacing.sm,
  },
});
