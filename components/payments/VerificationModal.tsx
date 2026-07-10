import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  AccessibilityInfo,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';
import { requestOTP, verifyOTP, type OtpMethod } from '@/services/otp';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { OtpCodeField } from '@/components/ui/OtpCodeField';
import { VerifyButton, type VerifyButtonState } from './verification/VerifyButton';
import { MethodCard } from './verification/MethodCard';
import { ResendSection } from './verification/ResendSection';
import { mapOtpError, maskEmail, maskPhone } from './verification/helpers';

interface Props {
  visible: boolean;
  onVerified: (token: string) => void;
  onClose: () => void;
}

type Phase = 'boot' | 'select' | 'enter' | 'success';
type DismissSource = 'backdrop' | 'button' | 'back';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;
/** Must stay in sync with the verification-token TTL in PaymentsSection. */
const SESSION_MINUTES = 10;
const SHEET_MAX_WIDTH = 480;
/** Above this window width the sheet floats as a centered card (tablet/landscape). */
const FLOATING_BREAKPOINT = 560;

interface MethodOption {
  method: OtpMethod;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  destination: string;
}

/**
 * Identity verification for payment-settings access. Rendered inside a real
 * RN Modal so it layers above all navigation chrome, handles the Android back
 * button, and resets its state on every open (Modal unmounts children when
 * hidden).
 */
export const VerificationModal: React.FC<Props> = ({ visible, onVerified, onClose }) => {
  const sheetRef = useRef<VerificationSheetHandle>(null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => sheetRef.current?.requestClose()}
    >
      {/* RNGH pressables inside a RN Modal need their own gesture root on Android */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <VerificationSheet ref={sheetRef} onVerified={onVerified} onClose={onClose} />
      </GestureHandlerRootView>
    </Modal>
  );
};

// ─── Sheet (all flow state lives here; fresh mount per open) ──────────────────

interface VerificationSheetHandle {
  requestClose: () => void;
}

interface SheetProps {
  onVerified: (token: string) => void;
  onClose: () => void;
}

const VerificationSheet = forwardRef<VerificationSheetHandle, SheetProps>(
  ({ onVerified, onClose }, ref) => {
    const user = useAuthStore((s: AuthState) => s.user);
    const insets = useSafeAreaInsets();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const reducedMotion = useReducedMotion();

    const methods = useMemo<MethodOption[]>(() => {
      const list: MethodOption[] = [];
      if (user?.shop?.phone) {
        list.push({
          method: 'sms',
          icon: 'phone-portrait-outline',
          title: 'Text message (SMS)',
          destination: maskPhone(user.shop.phone),
        });
      }
      if (user?.email) {
        list.push({
          method: 'email',
          icon: 'mail-outline',
          title: 'Email',
          destination: maskEmail(user.email),
        });
      }
      return list;
    }, [user]);

    const [phase, setPhase] = useState<Phase>(methods.length === 1 ? 'boot' : 'select');
    const [method, setMethod] = useState<OtpMethod>('email');
    const [sessionId, setSessionId] = useState('');
    const [sentTo, setSentTo] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [btnState, setBtnState] = useState<VerifyButtonState>('idle');
    const [sendingMethod, setSendingMethod] = useState<OtpMethod | null>(null);
    const [cooldownKey, setCooldownKey] = useState(0);
    const [resentFlash, setResentFlash] = useState(false);

    const verifyingRef = useRef(false);
    const clearCodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const entranceStarted = useRef(false);

    // Presentation: spring-in sheet + fading blurred backdrop, timed fade-out.
    const progress = useSharedValue(0);
    const sheetHeight = useSharedValue(windowHeight);

    const schedule = useCallback((fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
      return id;
    }, []);

    useEffect(
      () => () => {
        timers.current.forEach(clearTimeout);
        if (clearCodeTimer.current) clearTimeout(clearCodeTimer.current);
      },
      []
    );

    const handleSheetLayout = useCallback(
      (e: LayoutChangeEvent) => {
        sheetHeight.value = e.nativeEvent.layout.height;
        if (!entranceStarted.current) {
          entranceStarted.current = true;
          progress.value = reducedMotion
            ? withTiming(1, { duration: 200 })
            : withSpring(1, { damping: 26, stiffness: 280, mass: 0.9 });
        }
      },
      [progress, sheetHeight, reducedMotion]
    );

    const closeWith = useCallback(
      (cb: () => void) => {
        progress.value = withTiming(
          0,
          { duration: reducedMotion ? 150 : 220 },
          (finished) => {
            if (finished) runOnJS(cb)();
          }
        );
      },
      [progress, reducedMotion]
    );

    const dismiss = useCallback(
      (source: DismissSource) => {
        // A stray backdrop tap must not abort an in-flight verification or the
        // success handoff (which would discard the just-issued token); the
        // explicit close button and back gesture always work.
        if (btnState !== 'idle' && source === 'backdrop') return;
        closeWith(onClose);
      },
      [btnState, closeWith, onClose]
    );

    useImperativeHandle(ref, () => ({ requestClose: () => dismiss('back') }), [dismiss]);

    // ── Flow actions ─────────────────────────────────────────────────────────

    const send = useCallback(
      async (m: OtpMethod, opts: { isResend?: boolean } = {}) => {
        setSendingMethod(m);
        setError(null);
        try {
          const res = await requestOTP(m);
          setMethod(m);
          setSessionId(res.data.sessionId);
          setSentTo(res.data.sentTo);
          setCode('');
          setBtnState('idle');
          setPhase('enter');
          setCooldownKey((k) => k + 1);
          haptics.light();
          AccessibilityInfo.announceForAccessibility(
            `Verification code sent to ${res.data.sentTo}`
          );
          if (opts.isResend) {
            setResentFlash(true);
            schedule(() => setResentFlash(false), 2600);
          }
        } catch (err) {
          const e = mapOtpError(err, 'Could not send the code. Please try again.');
          haptics.error();
          setError(e.message);
          if (!opts.isResend) setPhase('select');
        } finally {
          setSendingMethod(null);
        }
      },
      [schedule]
    );

    // Single available method → skip the chooser and send immediately.
    useEffect(() => {
      if (phase === 'boot' && methods.length === 1) void send(methods[0].method);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const verify = useCallback(
      async (codeArg?: string) => {
        const otpCode = codeArg ?? code;
        if (otpCode.length < OTP_LENGTH || verifyingRef.current) return;
        verifyingRef.current = true;
        setBtnState('loading');
        setError(null);
        try {
          const res = await verifyOTP(sessionId, otpCode);
          setBtnState('success');
          haptics.success();
          AccessibilityInfo.announceForAccessibility('Identity verified');
          schedule(() => setPhase('success'), 700);
          schedule(() => closeWith(() => onVerified(res.data.verificationToken)), 2100);
        } catch (err) {
          const e = mapOtpError(err, 'Verification failed. Please try again.');
          haptics.error();
          setBtnState('idle');
          setError(e.message);
          // Leave the wrong code visible through the shake, then clear it —
          // cancelled if the user starts editing first.
          clearCodeTimer.current = setTimeout(() => setCode(''), 650);
        } finally {
          verifyingRef.current = false;
        }
      },
      [code, sessionId, schedule, closeWith, onVerified]
    );

    const handleCodeChange = useCallback((v: string) => {
      if (clearCodeTimer.current) {
        clearTimeout(clearCodeTimer.current);
        clearCodeTimer.current = null;
      }
      setCode(v);
      setError(null);
    }, []);

    const handleChangeMethod = useCallback(() => {
      haptics.selection();
      setPhase('select');
      setCode('');
      setError(null);
      setBtnState('idle');
    }, []);

    // ── Animated styles ──────────────────────────────────────────────────────

    const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
    const sheetStyle = useAnimatedStyle(() => ({
      opacity: reducedMotion ? progress.value : 1,
      transform: [
        { translateY: reducedMotion ? 0 : (1 - progress.value) * sheetHeight.value },
      ],
    }));

    const isFloating = windowWidth >= FLOATING_BREAKPOINT;
    const currentMethod = methods.find((m) => m.method === method);
    const stepAnim = reducedMotion
      ? FadeIn.duration(Motion.duration.base)
      : FadeInDown.duration(Motion.duration.slow);

    return (
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.dim} />
        </Animated.View>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => dismiss('backdrop')}
          accessibilityRole="button"
          accessibilityLabel="Dismiss verification"
        />

        <KeyboardAvoidingView behavior="padding" style={styles.kav} pointerEvents="box-none">
          <Animated.View
            onLayout={handleSheetLayout}
            style={[
              styles.sheet,
              isFloating
                ? [styles.sheetFloating, { marginBottom: Math.max(insets.bottom, Spacing.lg) }]
                : { paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.sm },
              sheetStyle,
            ]}
          >
            <View style={styles.handle} />
            <Pressable
              style={styles.closeBtn}
              onPress={() => dismiss('button')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close verification"
            >
              <Ionicons name="close" size={16} color={Colors.textSecondary} />
            </Pressable>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {phase === 'success' ? (
                <SuccessBlock reducedMotion={reducedMotion} />
              ) : (
                <>
                  <Hero phase={phase} reducedMotion={reducedMotion} />

                  {phase === 'boot' && (
                    <Animated.View key="boot" entering={stepAnim} style={styles.body}>
                      <View style={styles.sendingRow}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                        <Text style={styles.sendingText} maxFontSizeMultiplier={1.6}>
                          Sending your code to {methods[0]?.destination}…
                        </Text>
                      </View>
                    </Animated.View>
                  )}

                  {phase === 'select' && (
                    <Animated.View key="select" entering={stepAnim} style={styles.body}>
                      {methods.map((m) => (
                        <MethodCard
                          key={m.method}
                          icon={m.icon}
                          title={m.title}
                          destination={m.destination}
                          loading={sendingMethod === m.method}
                          disabled={!!sendingMethod}
                          onPress={() => send(m.method)}
                        />
                      ))}
                      {methods.length === 0 && (
                        <View style={styles.noContactCard}>
                          <Ionicons
                            name="alert-circle-outline"
                            size={18}
                            color={Colors.warning}
                          />
                          <Text style={styles.noContactText}>
                            {"There's no phone number or email on your account. Add one in your profile to verify your identity."}
                          </Text>
                        </View>
                      )}
                      {error ? (
                        <Animated.View
                          entering={FadeIn.duration(Motion.duration.base)}
                          style={styles.selectErrorRow}
                          accessibilityLiveRegion="polite"
                        >
                          <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                          <Text style={styles.selectErrorText}>{error}</Text>
                        </Animated.View>
                      ) : null}
                    </Animated.View>
                  )}

                  {phase === 'enter' && (
                    <Animated.View key="enter" entering={stepAnim} style={styles.body}>
                      <DestinationCard
                        icon={method === 'email' ? 'mail' : 'chatbubble-ellipses'}
                        label="Code sent to"
                        destination={sentTo || currentMethod?.destination || ''}
                        resentFlash={resentFlash}
                      />

                      <OtpCodeField
                        value={code}
                        onChange={handleCodeChange}
                        length={OTP_LENGTH}
                        error={error}
                        disabled={btnState !== 'idle'}
                        onComplete={verify}
                      />

                      <View style={styles.ctaBlock}>
                        <VerifyButton
                          state={btnState}
                          disabled={code.length < OTP_LENGTH}
                          onPress={() => verify()}
                        />
                        <ResendSection
                          key={cooldownKey}
                          cooldownSeconds={RESEND_COOLDOWN}
                          sending={sendingMethod !== null}
                          disabled={btnState !== 'idle'}
                          onResend={() => send(method, { isResend: true })}
                        />
                      </View>

                      {methods.length > 1 && (
                        <Pressable
                          style={styles.changeMethodBtn}
                          onPress={handleChangeMethod}
                          disabled={btnState !== 'idle'}
                          accessibilityRole="button"
                          accessibilityLabel="Use a different verification method"
                        >
                          <Ionicons
                            name="swap-horizontal-outline"
                            size={14}
                            color={Colors.primary}
                          />
                          <Text style={styles.changeMethodText} maxFontSizeMultiplier={1.6}>
                            Verify another way
                          </Text>
                        </Pressable>
                      )}
                    </Animated.View>
                  )}

                  <View style={styles.trustRow}>
                    <Ionicons name="lock-closed" size={12} color={Colors.textSecondary} />
                    <Text style={styles.trustText} maxFontSizeMultiplier={1.6}>
                      Codes are single-use and expire after 5 minutes
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    );
  }
);
VerificationSheet.displayName = 'VerificationSheet';

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HERO_SUB: Record<Exclude<Phase, 'success'>, string> = {
  boot: 'This extra step keeps your M-Pesa payment settings secure.',
  select: 'Choose where to receive your one-time security code.',
  enter: 'Enter the 6-digit code we sent you. This extra step keeps your M-Pesa payment settings secure.',
};

const Hero: React.FC<{ phase: Exclude<Phase, 'success'>; reducedMotion: boolean }> = ({
  phase,
  reducedMotion,
}) => {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.22);

  useEffect(() => {
    if (reducedMotion) return;
    pulseScale.value = withRepeat(
      withSequence(withTiming(1.2, { duration: 1600 }), withTiming(1, { duration: 1600 })),
      -1
    );
    pulseOpacity.value = withRepeat(
      withSequence(withTiming(0.1, { duration: 1600 }), withTiming(0.28, { duration: 1600 })),
      -1
    );
  }, [reducedMotion, pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={styles.hero}>
      <View style={styles.shieldContainer}>
        {!reducedMotion && <Animated.View style={[styles.glowRing, pulseStyle]} />}
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primaryLight]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.shield}
        >
          <Ionicons name="shield-checkmark" size={24} color={Colors.white} />
        </LinearGradient>
      </View>
      <Text style={styles.heroTitle} maxFontSizeMultiplier={1.8} accessibilityRole="header">
        Verify your identity
      </Text>
      <Text style={styles.heroSub} maxFontSizeMultiplier={1.8}>
        {HERO_SUB[phase]}
      </Text>
    </View>
  );
};

// ─── Destination card ─────────────────────────────────────────────────────────

const DestinationCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destination: string;
  resentFlash: boolean;
}> = ({ icon, label, destination, resentFlash }) => (
  <View style={styles.destCard}>
    <View style={styles.destIconWrap}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
    </View>
    <View style={styles.destText}>
      <Text style={styles.destLabel} maxFontSizeMultiplier={1.4}>
        {label.toUpperCase()}
      </Text>
      <Text
        style={styles.destValue}
        numberOfLines={1}
        ellipsizeMode="middle"
        maxFontSizeMultiplier={1.4}
      >
        {destination}
      </Text>
    </View>
    <View style={styles.sentBadge}>
      {resentFlash ? (
        <Animated.View entering={FadeIn.duration(Motion.duration.base)} style={styles.sentBadgeInner}>
          <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
          <Text style={styles.sentBadgeText} maxFontSizeMultiplier={1.2}>
            New code
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.sentBadgeInner}>
          <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
          <Text style={styles.sentBadgeText} maxFontSizeMultiplier={1.2}>
            Sent
          </Text>
        </View>
      )}
    </View>
  </View>
);

// ─── Success ──────────────────────────────────────────────────────────────────

const SuccessBlock: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => (
  <View style={styles.successWrap}>
    <Animated.View
      entering={
        reducedMotion
          ? FadeIn.duration(Motion.duration.base)
          : ZoomIn.springify().damping(14).stiffness(180)
      }
    >
      <View style={styles.successRing}>
        <LinearGradient
          colors={[Colors.success, Colors.successLight]}
          style={styles.successCircle}
        >
          <Ionicons name="checkmark" size={30} color={Colors.white} />
        </LinearGradient>
      </View>
    </Animated.View>
    <Text style={styles.successTitle} maxFontSizeMultiplier={1.8} accessibilityRole="header">
      Identity verified
    </Text>
    <Text style={styles.successSub} maxFontSizeMultiplier={1.8}>
      Payment settings are unlocked for the next {SESSION_MINUTES} minutes.
    </Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  // Sheet chrome
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    maxHeight: '90%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 24,
  },
  sheetFloating: {
    borderRadius: BorderRadius.sheet,
    paddingBottom: Spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
    marginTop: Spacing.sm + 4,
    opacity: 0.5,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  body: {
    gap: Spacing.md,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  shieldContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md - 4,
  },
  glowRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
  },
  shield: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  heroTitle: {
    fontSize: Typography.size.h3,
    lineHeight: Typography.lineHeight.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: Typography.letterSpacing.tight,
    marginBottom: Spacing.xs + 2,
  },
  heroSub: {
    fontSize: Typography.size.small,
    lineHeight: Typography.lineHeight.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Boot (auto-send)
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm + 4,
    paddingVertical: Spacing.lg,
  },
  sendingText: {
    flexShrink: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },

  // Select
  noContactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm + 4,
    backgroundColor: Colors.warningSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  noContactText: {
    flex: 1,
    fontSize: Typography.size.small,
    lineHeight: Typography.lineHeight.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  selectErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
  },
  selectErrorText: {
    flexShrink: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.danger,
    textAlign: 'center',
  },

  // Destination card
  destCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 4,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm + 4,
  },
  destIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm + 2,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  destText: {
    flex: 1,
    gap: 2,
  },
  destLabel: {
    fontSize: Typography.fontSize.xxs + 1,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  destValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  sentBadge: {
    flexShrink: 0,
  },
  sentBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.successSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  sentBadgeText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.success,
  },

  // CTA block
  ctaBlock: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  changeMethodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  changeMethodText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },

  // Trust footer
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  trustText: {
    flexShrink: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Success
  successWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  successRing: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.successSubtle,
    marginBottom: Spacing.md,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: Typography.size.h3,
    lineHeight: Typography.lineHeight.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: Typography.letterSpacing.tight,
    marginBottom: Spacing.xs + 2,
  },
  successSub: {
    fontSize: Typography.size.small,
    lineHeight: Typography.lineHeight.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
