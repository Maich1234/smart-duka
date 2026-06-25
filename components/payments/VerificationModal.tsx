import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withRepeat,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { requestOTP, verifyOTP, type OtpMethod } from '@/services/otp';
import { useAuthStore, type AuthState } from '@/store/authStore';

interface Props {
  visible: boolean;
  onVerified: (token: string) => void;
  onClose: () => void;
}

type Step = 'choose' | 'enter' | 'success';
type BtnState = 'idle' | 'loading' | 'success';

const RESEND_COOLDOWN = 60;
const OTP_LENGTH = 6;
const BODY_H_PAD = 20;

// ─── Main component ────────────────────────────────────────────────────────────

export const VerificationModal: React.FC<Props> = ({ visible, onVerified, onClose }) => {
  const { width: screenWidth } = useWindowDimensions();
  const user = useAuthStore((s: AuthState) => s.user);

  const [step, setStep] = useState<Step>('choose');
  const [method, setMethod] = useState<OtpMethod>('email');
  const [sessionId, setSessionId] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [btnState, setBtnState] = useState<BtnState>('idle');
  const [sendingMethod, setSendingMethod] = useState<OtpMethod | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const shakeX = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.25);

  const hasSms = !!user?.shop?.phone;
  const hasEmail = !!user?.email;

  // Responsive OTP sizing — always fits within the modal
  const boxGap = 8;
  const totalGaps = (OTP_LENGTH - 1) * boxGap;
  const rawBoxWidth = (screenWidth - BODY_H_PAD * 2 - totalGaps) / OTP_LENGTH;
  const boxWidth = Math.max(36, Math.min(52, rawBoxWidth));
  const boxHeight = Math.round(boxWidth * 1.14);

  // Shield pulsing glow
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.22, { duration: 1600 }),
        withTiming(1, { duration: 1600 })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.1, { duration: 1600 }),
        withTiming(0.3, { duration: 1600 })
      ),
      -1,
      false
    );
  }, []);

  // Countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeX.value = withSequence(
      withTiming(-10, { duration: 55 }),
      withTiming(10, { duration: 55 }),
      withTiming(-8, { duration: 55 }),
      withTiming(8, { duration: 55 }),
      withTiming(-4, { duration: 55 }),
      withTiming(0, { duration: 55 })
    );
  }, []);

  const handleSendOTP = useCallback(async (selectedMethod: OtpMethod) => {
    setSendingMethod(selectedMethod);
    setError('');
    try {
      const res = await requestOTP(selectedMethod);
      setSessionId(res.data.sessionId);
      setSentTo(res.data.sentTo);
      setMethod(selectedMethod);
      setOtp(Array(OTP_LENGTH).fill(''));
      setBtnState('idle');
      setStep('enter');
      setResendCooldown(RESEND_COOLDOWN);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to send code';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSendingMethod(null);
    }
  }, []);

  const handleOtpChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, '');
    setError('');

    // Paste: fill from this cell forward
    if (digits.length > 1) {
      const next = [...otp];
      let lastFilled = index;
      for (let i = 0; i < digits.length && index + i < OTP_LENGTH; i++) {
        next[index + i] = digits[i];
        lastFilled = index + i;
      }
      setOtp(next);
      const focusTarget = Math.min(lastFilled + 1, OTP_LENGTH - 1);
      inputRefs.current[focusTarget]?.focus();
      if (next.every(Boolean)) handleVerify(next.join(''));
      return;
    }

    const digit = digits.slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (next.every(Boolean)) handleVerify(next.join(''));
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code ?? otp.join('');
    if (otpCode.length < OTP_LENGTH) return;
    setBtnState('loading');
    setError('');
    try {
      const res = await verifyOTP(sessionId, otpCode);
      setBtnState('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
      setTimeout(() => onVerified(res.data.verificationToken), 1400);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Invalid code';
      setError(msg);
      setBtnState('idle');
      triggerShake();
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    }
  };

  const handleResend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleSendOTP(method);
  };

  const handleChangeMethod = () => {
    Haptics.selectionAsync();
    setStep('choose');
    setError('');
    setBtnState('idle');
    setOtp(Array(OTP_LENGTH).fill(''));
  };

  if (!visible) return null;

  const countdown = `${Math.floor(resendCooldown / 60)}:${String(resendCooldown % 60).padStart(2, '0')}`;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {/* Blurred backdrop */}
      <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.backdropOverlay} />
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

      {/* Bottom sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <Animated.View
          entering={FadeInDown.springify().damping(24).stiffness(230).mass(0.85)}
          style={styles.sheet}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close verification"
          >
            <Ionicons name="close" size={14} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <View style={styles.heroSection}>
            <View style={styles.shieldContainer}>
              <Animated.View style={[styles.glowRing, pulseStyle]} />
              <LinearGradient
                colors={['#0D6B63', '#14B8A6']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.shieldGradient}
              >
                <Ionicons name="shield-checkmark" size={26} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={styles.heroTitle}>Identity Verification</Text>
            <Text style={styles.heroSub}>
              {step === 'choose'
                ? 'Choose how to receive your one-time verification code.'
                : step === 'enter'
                ? 'Verify your identity before approving this M-Pesa transaction.'
                : 'Your identity has been verified.'}
            </Text>
          </View>

          {/* ── Step: Choose method ───────────────────────────────────────── */}
          {step === 'choose' && (
            <Animated.View entering={FadeInDown.duration(240)} style={styles.body}>
              {hasSms && (
                <MethodCard
                  icon="phone-portrait-outline"
                  title="SMS Verification"
                  sub={maskPhone(user?.shop?.phone)}
                  badge={!hasEmail ? 'Recommended' : undefined}
                  loading={sendingMethod === 'sms'}
                  disabled={!!sendingMethod}
                  onPress={() => handleSendOTP('sms')}
                />
              )}
              {hasEmail && (
                <MethodCard
                  icon="mail-outline"
                  title="Email Verification"
                  sub={maskEmail(user?.email)}
                  badge={!hasSms ? 'Recommended' : undefined}
                  loading={sendingMethod === 'email'}
                  disabled={!!sendingMethod}
                  onPress={() => handleSendOTP('email')}
                />
              )}
              {!hasSms && !hasEmail && (
                <View style={styles.noContactCard}>
                  <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
                  <Text style={styles.noContactText}>
                    No phone or email on file. Please update your profile to use this feature.
                  </Text>
                </View>
              )}
              {error ? (
                <Animated.Text entering={FadeIn.duration(150)} style={styles.errorText}>
                  {error}
                </Animated.Text>
              ) : null}
            </Animated.View>
          )}

          {/* ── Step: Enter OTP ───────────────────────────────────────────── */}
          {step === 'enter' && (
            <Animated.View entering={FadeInDown.duration(240)} style={styles.body}>

              {/* Destination pill */}
              <View style={styles.destinationPill}>
                <LinearGradient colors={['#E6F4F2', '#CCE9E6']} style={styles.destIconWrap}>
                  <Ionicons
                    name={method === 'email' ? 'mail' : 'phone-portrait'}
                    size={12}
                    color={Colors.primary}
                  />
                </LinearGradient>
                <Text style={styles.destText} numberOfLines={1} ellipsizeMode="middle">
                  {sentTo}
                </Text>
                <View style={styles.destSentBadge}>
                  <View style={styles.destSentDot} />
                  <Text style={styles.destSentText}>Sent</Text>
                </View>
              </View>

              {/* OTP inputs */}
              <Animated.View style={[styles.otpRow, shakeStyle]}>
                {otp.map((digit, i) => (
                  <OtpCell
                    key={i}
                    ref={(r) => { inputRefs.current[i] = r; }}
                    value={digit}
                    index={i}
                    isFocused={focusedIdx === i}
                    hasError={!!error}
                    boxWidth={boxWidth}
                    boxHeight={boxHeight}
                    onChangeText={(v) => handleOtpChange(v, i)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                    onFocus={() => setFocusedIdx(i)}
                    onBlur={() => setFocusedIdx(-1)}
                    editable={btnState !== 'loading'}
                  />
                ))}
              </Animated.View>

              {/* Error */}
              {error ? (
                <Animated.Text entering={FadeIn.duration(150)} style={styles.errorText}>
                  {error}
                </Animated.Text>
              ) : null}

              {/* Expiry note */}
              <View style={styles.securityNote}>
                <Ionicons name="lock-closed" size={10} color={Colors.textTertiary} />
                <Text style={styles.securityNoteText}>Code expires in 5 minutes</Text>
              </View>

              {/* Verify button */}
              <VerifyButton
                state={btnState}
                disabled={otp.join('').length < OTP_LENGTH || btnState !== 'idle'}
                onPress={handleVerify}
              />

              {/* Resend section */}
              <View style={styles.resendSection}>
                <Text style={styles.resendQuestion}>Didn't receive a code?</Text>
                {resendCooldown > 0 ? (
                  <View style={styles.countdownRow}>
                    <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
                    <Text style={styles.countdownText}>Resend in {countdown}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleResend}
                    style={styles.resendActionBtn}
                    activeOpacity={0.72}
                    disabled={btnState === 'loading'}
                    accessibilityRole="button"
                    accessibilityLabel="Resend verification code"
                  >
                    <Ionicons name="refresh-outline" size={12} color={Colors.primary} />
                    <Text style={styles.resendActionText}>Resend Code</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Change method */}
              <TouchableOpacity
                style={styles.changeMethodBtn}
                onPress={handleChangeMethod}
                activeOpacity={0.7}
                disabled={btnState === 'loading'}
                accessibilityRole="button"
              >
                <Ionicons name="swap-horizontal-outline" size={13} color={Colors.textTertiary} />
                <Text style={styles.changeMethodText}>Try a different verification method</Text>
              </TouchableOpacity>

              {/* Trust card */}
              <View style={styles.trustCard}>
                <Ionicons name="lock-closed-outline" size={13} color={Colors.primary} />
                <Text style={styles.trustText}>
                  Verification codes are encrypted end-to-end and used solely to authorize this transaction.
                </Text>
              </View>

            </Animated.View>
          )}

          {/* ── Step: Success ──────────────────────────────────────────────── */}
          {step === 'success' && (
            <Animated.View entering={FadeInDown.duration(260)} style={styles.body}>
              <View style={styles.successWrap}>
                <Animated.View entering={ZoomIn.springify().damping(14).stiffness(180)}>
                  <View style={styles.successRing}>
                    <LinearGradient colors={['#15803D', '#22C55E']} style={styles.successCircle}>
                      <Ionicons name="checkmark" size={30} color="#fff" />
                    </LinearGradient>
                  </View>
                </Animated.View>
                <Text style={styles.successTitle}>Transaction Authorized</Text>
                <Text style={styles.successSub}>
                  Your identity has been verified. Opening payment settings…
                </Text>
              </View>
            </Animated.View>
          )}

        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

// ─── OTP Cell ─────────────────────────────────────────────────────────────────

interface OtpCellProps {
  value: string;
  index: number;
  isFocused: boolean;
  hasError: boolean;
  boxWidth: number;
  boxHeight: number;
  onChangeText: (v: string) => void;
  onKeyPress: (e: any) => void;
  onFocus: () => void;
  onBlur: () => void;
  editable: boolean;
}

const OtpCell = forwardRef<TextInput, OtpCellProps>(
  ({ value, index, isFocused, hasError, boxWidth, boxHeight, ...inputProps }, ref) => {
    const scale = useSharedValue(1);

    useEffect(() => {
      scale.value = withSpring(isFocused ? 1.07 : 1, { damping: 16, stiffness: 240 });
    }, [isFocused]);

    const cellAnim = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const isFilled = value.length > 0;

    let borderColor: string = Colors.border;
    let borderWidth = 1.5;
    let bgColor: string = Colors.background;
    let textColor: string = Colors.textPrimary;
    let shadowColor = 'transparent';
    let shadowOpacity = 0;
    let shadowRadius = 0;
    let elevation = 0;

    if (hasError) {
      borderColor = Colors.danger;
      borderWidth = 2;
      bgColor = Colors.dangerSubtle;
      textColor = Colors.danger;
    } else if (isFocused) {
      borderColor = Colors.primary;
      borderWidth = 2;
      bgColor = Colors.primarySubtle;
      shadowColor = Colors.primary;
      shadowOpacity = 0.22;
      shadowRadius = 8;
      elevation = 4;
    } else if (isFilled) {
      borderColor = Colors.success;
      borderWidth = 1.5;
      bgColor = Colors.successSubtle;
      textColor = Colors.success;
    }

    return (
      <Animated.View
        style={[
          cellAnim,
          {
            shadowColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity,
            shadowRadius,
            elevation,
            borderRadius: 12,
          },
        ]}
      >
        <TextInput
          ref={ref}
          style={{
            width: boxWidth,
            height: boxHeight,
            borderRadius: 12,
            borderWidth,
            borderColor,
            backgroundColor: bgColor,
            textAlign: 'center',
            fontSize: 20,
            fontFamily: Typography.fontFamilyBold,
            color: textColor,
            includeFontPadding: false,
          }}
          value={value}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          selectTextOnFocus
          accessibilityLabel={`Digit ${index + 1} of ${OTP_LENGTH}`}
          {...inputProps}
        />
      </Animated.View>
    );
  }
);

// ─── Verify button ────────────────────────────────────────────────────────────

interface VerifyButtonProps {
  state: BtnState;
  disabled: boolean;
  onPress: () => void;
}

const VerifyButton: React.FC<VerifyButtonProps> = ({ state, disabled, onPress }) => {
  const handlePress = () => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

  if (state === 'success') {
    return (
      <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.verifyBtnShadow}>
        <View style={styles.verifyBtnClip}>
          <LinearGradient
            colors={['#15803D', '#22C55E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.verifyBtnInner}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.verifyBtnText}>Verified Successfully</Text>
          </LinearGradient>
        </View>
      </Animated.View>
    );
  }

  const isDisabled = disabled || state === 'loading';
  const gradColors: [string, string] = isDisabled && state !== 'loading'
    ? [Colors.disabledBackground, Colors.disabledBackground]
    : ['#0F766E', '#14B8A6'];

  return (
    <View style={[styles.verifyBtnShadow, isDisabled && { shadowOpacity: 0, elevation: 0 }]}>
      <TouchableOpacity
        style={styles.verifyBtnClip}
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.84}
        accessibilityRole="button"
        accessibilityLabel={state === 'loading' ? 'Verifying transaction' : 'Verify transaction'}
        accessibilityState={{ disabled: isDisabled }}
      >
        <LinearGradient
          colors={gradColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.verifyBtnInner}
        >
          {state === 'loading' ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.verifyBtnText}>Verifying…</Text>
            </>
          ) : (
            <>
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={isDisabled ? Colors.textDisabled : '#fff'}
              />
              <Text style={[styles.verifyBtnText, isDisabled && styles.verifyBtnTextDisabled]}>
                Verify Transaction
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// ─── Method card ──────────────────────────────────────────────────────────────

interface MethodCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  badge?: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}

const MethodCard: React.FC<MethodCardProps> = ({
  icon, title, sub, badge, loading, disabled, onPress,
}) => (
  <TouchableOpacity
    style={styles.methodCard}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.74}
    accessibilityRole="button"
    accessibilityLabel={title}
  >
    <View style={styles.methodIconWrap}>
      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Ionicons name={icon} size={18} color={Colors.primary} />
      )}
    </View>
    <View style={styles.methodText}>
      <View style={styles.methodTitleRow}>
        <Text style={styles.methodTitle}>{title}</Text>
        {badge && (
          <View style={styles.methodBadge}>
            <Text style={styles.methodBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.methodSub} numberOfLines={1}>{sub}</Text>
    </View>
    <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
  </TouchableOpacity>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(phone?: string | null): string {
  if (!phone) return 'your phone number';
  const c = phone.replace(/\s/g, '');
  return c.length < 4 ? c : c.slice(0, -3).replace(/\d/g, '*') + c.slice(-3);
}

function maskEmail(email?: string | null): string {
  if (!email) return 'your email';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = '*'.repeat(Math.max(1, local.length - 1));
  return `${local[0]}${masked}@${domain}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Layout ─────────────────────────────────────────────────────
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.32)',
  },
  sheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(226,232,240,0.7)',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
    marginTop: 12,
    opacity: 0.45,
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  body: {
    paddingHorizontal: BODY_H_PAD,
    paddingTop: 4,
  },

  // ── Hero ───────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 20,
  },
  shieldContainer: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  glowRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primary,
  },
  shieldGradient: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 10,
  },
  heroTitle: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 7,
  },
  heroSub: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Method cards ───────────────────────────────────────────────
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  methodIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  methodText: { flex: 1 },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  methodTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  methodBadge: {
    backgroundColor: Colors.accentSubtle,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  methodBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.accentDark,
  },
  methodSub: {
    fontSize: 12,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  noContactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.warningSubtle,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  noContactText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── Destination pill ───────────────────────────────────────────
  destinationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    marginBottom: 20,
  },
  destIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  destText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  destSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    flexShrink: 0,
  },
  destSentDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  destSentText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.success,
  },

  // ── OTP inputs ─────────────────────────────────────────────────
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 10,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 16,
  },
  securityNoteText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },

  // ── Verify button ──────────────────────────────────────────────
  verifyBtnShadow: {
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 7,
    marginBottom: 16,
  },
  verifyBtnClip: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  verifyBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 24,
  },
  verifyBtnText: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#fff',
  },
  verifyBtnTextDisabled: {
    color: Colors.textDisabled,
  },

  // ── Resend section ─────────────────────────────────────────────
  resendSection: {
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  resendQuestion: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countdownText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
  },
  resendActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 14,
    backgroundColor: Colors.primarySubtle,
    borderRadius: BorderRadius.full,
  },
  resendActionText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },

  // ── Change method ──────────────────────────────────────────────
  changeMethodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    marginBottom: 12,
  },
  changeMethodText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },

  // ── Trust card ─────────────────────────────────────────────────
  trustCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primarySubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
  },
  trustText: {
    flex: 1,
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  // ── Error ──────────────────────────────────────────────────────
  errorText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },

  // ── Success ────────────────────────────────────────────────────
  successWrap: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  successRing: {
    padding: 7,
    borderRadius: 44,
    backgroundColor: Colors.successSubtle,
    marginBottom: 18,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  successSub: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
});
