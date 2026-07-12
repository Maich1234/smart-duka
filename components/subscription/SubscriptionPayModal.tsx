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
import {
  initiateSubscriptionPayment,
  getSubscriptionPaymentStatus,
  previewPricing,
  validatePromo,
  type BillingCycle,
} from '@/services/subscription';

type Stage = 'input' | 'initiating' | 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout';

interface SubscriptionPayModalProps {
  visible: boolean;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  planSlug?: string;
  promoCode?: string;
  /** Prefill — the owner usually pays with their own line. */
  defaultPhone?: string;
  onClose: () => void;
  /** Called after the user acknowledges a successful payment. */
  onSuccess: () => void;
}

const POLL_INTERVAL_MS = 3500;
const POLL_TIMEOUT_MS = 120_000;

/**
 * Owner-facing M-PESA STK Push flow for subscription payments. The amount is
 * displayed but never sent — the server recomputes it. One idempotency key
 * per attempt so a retried initiate never double-prompts the phone.
 */
export const SubscriptionPayModal: React.FC<SubscriptionPayModalProps> = ({
  visible,
  amount,
  currency,
  billingCycle,
  planSlug,
  promoCode,
  defaultPhone,
  onClose,
  onSuccess,
}) => {
  const [stage, setStage] = useState<Stage>('input');
  const [digits, setDigits] = useState(() => (defaultPhone ?? '').replace(/^\+?254/, '').replace(/\D/g, '').slice(0, 9));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [showPromo, setShowPromo] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoState, setPromoState] = useState<'idle' | 'checking' | 'applied' | 'error'>('idle');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; title: string; description: string } | null>(null);
  const [discountedAmount, setDiscountedAmount] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

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
    setShowPromo(false);
    setPromoInput('');
    setPromoState('idle');
    setPromoError(null);
    setAppliedPromo(null);
    setDiscountedAmount(null);
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const handleSuccess = () => {
    reset();
    onSuccess();
  };

  useEffect(() => {
    if (stage === 'success') haptics.success();
    else if (stage === 'failed') haptics.error();
    else if (stage === 'cancelled' || stage === 'timeout') haptics.warning();
  }, [stage]);

  const phoneValid = /^[17]\d{8}$/.test(digits);
  const displayAmount = discountedAmount ?? amount;

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    haptics.light();
    setPromoState('checking');
    setPromoError(null);
    try {
      const res = await validatePromo(code);
      const preview = await previewPricing({ billingCycle, planSlug, promoCode: code });
      setAppliedPromo({ code: res.data.code, title: res.data.title, description: res.data.description });
      setDiscountedAmount(preview.data.amountDue);
      setPromoState('applied');
      haptics.success();
    } catch (err: any) {
      setPromoState('error');
      setPromoError(err?.response?.data?.message ?? 'This promo code is invalid or has expired.');
      setAppliedPromo(null);
      setDiscountedAmount(null);
    }
  };

  const removePromo = () => {
    haptics.light();
    setPromoInput('');
    setPromoState('idle');
    setPromoError(null);
    setAppliedPromo(null);
    setDiscountedAmount(null);
  };

  const startPolling = (paymentId: string) => {
    startedAtRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) {
        stopPolling();
        setStage('timeout');
        setErrorMessage('The payment request expired before it was confirmed.');
        return;
      }
      try {
        const res = await getSubscriptionPaymentStatus(paymentId);
        const { status, receipt: rcpt, errorMessage: err } = res.data;
        if (status === 'pending') return;
        stopPolling();
        setReceipt(rcpt);
        setErrorMessage(err);
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
      const res = await initiateSubscriptionPayment(
        { phoneNumber: `+254${digits}`, billingCycle, planSlug, promoCode: appliedPromo?.code ?? promoCode },
        randomUUID()
      );
      if (res.data.status === 'pending') {
        setStage('pending');
        startPolling(res.data.paymentId);
      } else {
        // Idempotent replay of an already-settled attempt.
        setStage(res.data.status);
      }
    } catch (err: any) {
      setStage('failed');
      setErrorMessage(err?.response?.data?.message ?? 'Could not start the payment. Check your connection and try again.');
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
                  <Ionicons name="phone-portrait-outline" size={26} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Pay with M-PESA</Text>
              <Text style={styles.sub}>
                We’ll send a payment prompt of{' '}
                <Text style={styles.emph}>{formatCurrency(displayAmount, currency)}</Text> to your phone.
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

              {appliedPromo ? (
                <View style={styles.promoApplied}>
                  <Ionicons name="pricetag" size={15} color={Colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoAppliedTitle}>{appliedPromo.title || appliedPromo.code}</Text>
                    {!!appliedPromo.description && (
                      <Text style={styles.promoAppliedSub}>{appliedPromo.description}</Text>
                    )}
                  </View>
                  <AnimatedPressable onPress={removePromo} accessibilityRole="button" accessibilityLabel="Remove promo code">
                    <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                  </AnimatedPressable>
                </View>
              ) : showPromo ? (
                <View style={styles.promoRow}>
                  <TextInput
                    style={styles.promoInput}
                    value={promoInput}
                    onChangeText={(t) => {
                      setPromoInput(t.toUpperCase());
                      if (promoState === 'error') setPromoState('idle');
                    }}
                    placeholder="Promo code"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel="Promo code"
                  />
                  <AnimatedPressable
                    onPress={applyPromo}
                    disabled={!promoInput.trim() || promoState === 'checking'}
                    style={[styles.promoApplyBtn, (!promoInput.trim() || promoState === 'checking') && styles.promoApplyBtnDisabled]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.promoApplyText}>{promoState === 'checking' ? '…' : 'Apply'}</Text>
                  </AnimatedPressable>
                </View>
              ) : (
                <AnimatedPressable
                  onPress={() => setShowPromo(true)}
                  style={styles.promoLink}
                  accessibilityRole="button"
                >
                  <Ionicons name="pricetag-outline" size={14} color={Colors.primary} />
                  <Text style={styles.promoLinkText}>Have a promo code?</Text>
                </AnimatedPressable>
              )}
              {promoState === 'error' && !!promoError && (
                <Text style={styles.promoErrorText}>{promoError}</Text>
              )}

              <Button
                title={`Pay ${formatCurrency(displayAmount, currency)}`}
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
              <Text style={styles.title}>Payment received</Text>
              <Text style={styles.sub}>
                {formatCurrency(amount, currency)} paid
                {receipt ? ` · Receipt ${receipt}` : ''}.{'\n'}Your subscription is active.
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
                    : 'The payment did not go through. No money was taken.')}
              </Text>
              <Button title="Try again" onPress={() => setStage('input')} style={{ alignSelf: 'stretch' }} />
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
  promoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  promoLinkText: {
    color: Colors.primary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  promoRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  promoInput: {
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
  promoApplyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoApplyBtnDisabled: { opacity: 0.5 },
  promoApplyText: {
    color: '#FFFFFF',
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  promoErrorText: {
    color: Colors.danger,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  promoApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    backgroundColor: Colors.successSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.success,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  promoAppliedTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  promoAppliedSub: {
    color: Colors.textSecondary,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    marginTop: 1,
  },
});
