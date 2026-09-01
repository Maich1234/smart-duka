import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  AccessibilityInfo,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
  interpolateColor,
  useReducedMotion,
  FadeIn,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';

export type OtpStatus = 'idle' | 'loading' | 'success';

interface OtpCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  /** Error message — turns cells red, shakes the row, and announces to screen readers. */
  error?: string | null;
  /** Drives the loading spin / success checkmark animation. Error feedback stays on the `error` prop. */
  status?: OtpStatus;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Fires once each time the code reaches full length — via typing, autofill, or paste. */
  onComplete?: (code: string) => void;
  style?: StyleProp<ViewStyle>;
}

const BASE_BOX_SIZE = 44;
const BASE_GAP = 10;
const MIN_BOX_SIZE = 32;
const MIN_GAP = 4;
const RADIUS_MARGIN = 10;
const EDGE_PADDING = 4;
const MAX_FONT_SCALE = 1.4;

const MORPH_SPRING = { damping: 16, stiffness: 100, mass: 0.8 };
const MERGE_SPRING = { damping: 14, stiffness: 90, mass: 0.8 };
const SPIN_DURATION = 2400;

/**
 * One-time-code entry built on a single invisible TextInput overlaying a ring
 * of rendered boxes. A single input (vs. six chained inputs) is what makes OS
 * -level code autofill, paste, backspace, and screen-reader focus behave
 * correctly on both platforms.
 *
 * Boxes sit at the end of an invisible rotating "arm" (rotate + translateX)
 * so the same coordinates drive the idle row, the loading spinner, and the
 * success merge — one continuous system instead of three swapped layouts.
 */
export const OtpCodeField: React.FC<OtpCodeFieldProps> = ({
  value,
  onChange,
  length = 6,
  error,
  status = 'idle',
  disabled = false,
  autoFocus = true,
  onComplete,
  style,
}) => {
  const inputRef = useRef<TextInput>(null);
  const lastSubmitted = useRef<string | null>(null);
  const prevError = useRef<string | null | undefined>(error);
  const prevStatus = useRef<OtpStatus>(status);
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);

  const shakeX = useSharedValue(0);
  const morphProgress = useSharedValue(status === 'idle' ? 0 : 1);
  const spinRotation = useSharedValue(0);
  const successMerge = useSharedValue(status === 'success' ? 1 : 0);
  const [isFocused, setIsFocused] = React.useState(false);

  const geometry = useMemo(() => {
    const scale = Math.min(Math.max(fontScale, 1), MAX_FONT_SCALE);
    let boxSize = Math.round(BASE_BOX_SIZE * scale);
    let gap = Math.round(BASE_GAP * scale);

    if (availableWidth) {
      const maxTotal = availableWidth - EDGE_PADDING * 2;
      const naturalTotal = length * boxSize + (length - 1) * gap;
      if (maxTotal > 0 && naturalTotal > maxTotal) {
        const shrink = maxTotal / naturalTotal;
        boxSize = Math.max(MIN_BOX_SIZE, Math.floor(boxSize * shrink));
        gap = Math.max(MIN_GAP, Math.floor(gap * shrink));
      }
    }

    const totalWidth = length * boxSize + (length - 1) * gap;
    const minRadius = length > 1 ? boxSize / (2 * Math.sin(Math.PI / length)) : 0;
    const radius = Math.max(minRadius + RADIUS_MARGIN, boxSize);
    const halfWidth = Math.max(totalWidth / 2, radius + boxSize / 2);
    const halfHeight = Math.max(boxSize / 2, radius + boxSize / 2);

    const leftCount = Math.ceil(length / 2);
    const rightCount = Math.floor(length / 2);
    const step = length > 0 ? 360 / length : 0;

    const arms = Array.from({ length }, (_, index) => {
      const centerOffset = -totalWidth / 2 + index * (boxSize + gap) + boxSize / 2;
      const idleAngle = centerOffset >= 0 ? 0 : 180;
      const idleDist = Math.abs(centerOffset);
      let loadingAngle: number;
      if (index < leftCount) {
        loadingAngle = leftCount > 1 ? 180 + index * step : 180;
      } else {
        const j = index - leftCount;
        loadingAngle = rightCount > 1 ? (rightCount - 1 - j) * step : 0;
      }
      return { idleAngle, idleDist, loadingAngle };
    });

    return {
      boxSize,
      radius,
      wrapperWidth: halfWidth * 2,
      wrapperHeight: halfHeight * 2,
      arms,
    };
  }, [length, fontScale, availableWidth]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setAvailableWidth((prev) => (prev === width ? prev : width));
  };

  const handleChangeText = (text: string) => {
    onChange(text.replace(/\D/g, '').slice(0, length));
  };

  const submit = (code: string) => {
    if (code.length < length || code === lastSubmitted.current) return;
    lastSubmitted.current = code;
    onComplete?.(code);
  };

  // Deferred focus: autoFocus on a TextInput mounted inside a Modal or during
  // an entering animation is unreliable on Android, so focus explicitly.
  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-submit once per distinct full entry; re-arm when the code shortens
  useEffect(() => {
    if (value.length < length) {
      lastSubmitted.current = null;
      return;
    }
    submit(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, length]);

  // Error feedback: shake + announce, without stealing keyboard focus
  useEffect(() => {
    if (error && error !== prevError.current) {
      AccessibilityInfo.announceForAccessibility(error);
      if (!reducedMotion) {
        shakeX.value = withSequence(
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }),
          withTiming(-6, { duration: 50 }),
          withTiming(6, { duration: 50 }),
          withTiming(0, { duration: 50 })
        );
      }
    }
    prevError.current = error;
  }, [error, reducedMotion, shakeX]);

  // Status feedback: morph the row into a spinning ring, then merge to a checkmark
  useEffect(() => {
    if (status !== prevStatus.current) {
      if (status === 'loading') {
        AccessibilityInfo.announceForAccessibility('Verifying code');
      } else if (status === 'success') {
        AccessibilityInfo.announceForAccessibility('Code verified');
      }
    }
    prevStatus.current = status;

    if (status === 'loading') {
      morphProgress.value = reducedMotion ? 1 : withSpring(1, MORPH_SPRING);
      successMerge.value = reducedMotion ? 0 : withTiming(0, { duration: 150 });
      spinRotation.value = reducedMotion
        ? 0
        : withRepeat(withTiming(360, { duration: SPIN_DURATION, easing: Easing.inOut(Easing.quad) }), -1, false);
    } else if (status === 'success') {
      morphProgress.value = reducedMotion ? 1 : withSpring(1, MORPH_SPRING);
      successMerge.value = reducedMotion ? 1 : withSpring(1, MERGE_SPRING);
      spinRotation.value = reducedMotion
        ? 0
        : withTiming(Math.ceil(spinRotation.value / 90) * 90 + 90, {
            duration: 500,
            easing: Easing.out(Easing.cubic),
          });
    } else {
      morphProgress.value = reducedMotion ? 0 : withSpring(0, MORPH_SPRING);
      successMerge.value = reducedMotion ? 0 : withTiming(0, { duration: 150 });
      spinRotation.value = reducedMotion ? 0 : withTiming(0, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, reducedMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { rotate: `${spinRotation.value}deg` }] as any,
  }));

  const checkmarkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(successMerge.value, [0.6, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(successMerge.value, [0.6, 1], [0.3, 1], Extrapolation.CLAMP) },
      { rotate: `${-spinRotation.value}deg` },
    ] as any,
  }));

  const activeIndex = Math.min(value.length, length - 1);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  return (
    <View style={style} onLayout={handleLayout}>
      <View style={[styles.wrapper, { width: geometry.wrapperWidth, height: geometry.wrapperHeight }]}>
        <Animated.View style={[styles.centerPoint, containerStyle]}>
          {digits.map((digit, i) => (
            <OrbCell
              key={i}
              digit={digit}
              isActive={isFocused && !disabled && status === 'idle' && i === activeIndex}
              hasError={!!error}
              isBadge={i === 0}
              statusIdle={status === 'idle'}
              boxSize={geometry.boxSize}
              idleAngle={geometry.arms[i].idleAngle}
              idleDist={geometry.arms[i].idleDist}
              loadingAngle={geometry.arms[i].loadingAngle}
              radius={geometry.radius}
              morphProgress={morphProgress}
              spinRotation={spinRotation}
              successMerge={successMerge}
            />
          ))}

          <Animated.View
            style={[styles.checkmarkContainer, checkmarkStyle]}
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Ionicons name="checkmark" size={Math.round(geometry.boxSize * 0.6)} color={Colors.white} />
          </Animated.View>
        </Animated.View>

        {/* Invisible input covering the whole ring: taps focus it, long-press
            offers Paste, and OS autofill lands in one place. */}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!disabled && status === 'idle'}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          // No maxLength: pasted codes may carry spaces/dashes ("123 456") and
          // would be truncated natively before onChangeText can sanitize them.
          caretHidden
          contextMenuHidden={false}
          style={styles.hiddenInput}
          accessibilityLabel={`Verification code. ${value.length} of ${length} digits entered.${
            status === 'loading' ? ' Verifying.' : status === 'success' ? ' Verified.' : ''
          }`}
          accessibilityHint="Enter the code you received"
        />
      </View>

      {error ? (
        <Animated.View
          entering={FadeIn.duration(Motion.duration.base)}
          style={styles.errorRow}
          accessibilityLiveRegion="polite"
        >
          <Ionicons name="alert-circle" size={14} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
};

// ─── OrbCell ────────────────────────────────────────────────────────────────

interface OrbCellProps {
  digit: string;
  isActive: boolean;
  hasError: boolean;
  isBadge: boolean;
  statusIdle: boolean;
  boxSize: number;
  idleAngle: number;
  idleDist: number;
  loadingAngle: number;
  radius: number;
  morphProgress: SharedValue<number>;
  spinRotation: SharedValue<number>;
  successMerge: SharedValue<number>;
}

const OrbCell = memo<OrbCellProps>(
  ({
    digit,
    isActive,
    hasError,
    isBadge,
    statusIdle,
    boxSize,
    idleAngle,
    idleDist,
    loadingAngle,
    radius,
    morphProgress,
    spinRotation,
    successMerge,
  }) => {
    const focus = useSharedValue(0);
    const caretOpacity = useSharedValue(1);
    const reducedMotion = useReducedMotion();

    useEffect(() => {
      focus.value = withTiming(isActive ? 1 : 0, { duration: Motion.duration.fast });
    }, [isActive, focus]);

    useEffect(() => {
      if (isActive && !digit && statusIdle && !reducedMotion) {
        caretOpacity.value = withRepeat(
          withSequence(withTiming(0, { duration: 500 }), withTiming(1, { duration: 500 })),
          -1
        );
      } else {
        caretOpacity.value = 1;
      }
    }, [isActive, digit, statusIdle, reducedMotion, caretOpacity]);

    const armStyle = useAnimatedStyle(() => {
      const angle = interpolate(morphProgress.value, [0, 1], [idleAngle, loadingAngle]);
      return { transform: [{ rotate: `${angle}deg` }] };
    });

    const boxStyle = useAnimatedStyle(() => {
      const angle = interpolate(morphProgress.value, [0, 1], [idleAngle, loadingAngle]);
      const loadingDistNow = interpolate(morphProgress.value, [0, 1], [idleDist, radius]);
      const finalDist = interpolate(successMerge.value, [0, 1], [loadingDistNow, 0]);
      const counterRotate = -angle - spinRotation.value;

      const idleBorder = hasError
        ? Colors.danger
        : interpolateColor(focus.value, [0, 1], [digit ? Colors.borderStrong : Colors.border, Colors.primary]);
      const idleBg = hasError
        ? Colors.dangerSubtle
        : interpolateColor(focus.value, [0, 1], [Colors.surface, Colors.primarySubtle]);

      const borderColor = interpolateColor(successMerge.value, [0, 1], [idleBorder, Colors.success]);
      const backgroundColor = interpolateColor(successMerge.value, [0, 1], [idleBg, Colors.success]);

      return {
        width: boxSize,
        height: boxSize,
        transform: [{ translateX: finalDist }, { rotate: `${counterRotate}deg` }] as any,
        borderColor,
        backgroundColor,
        borderRadius: interpolate(successMerge.value, [0, 1], [BorderRadius.md, boxSize / 2]),
        opacity: isBadge ? 1 : interpolate(successMerge.value, [0.5, 1], [1, 0], Extrapolation.CLAMP),
        shadowColor: isActive ? Colors.primary : successMerge.value > 0 ? Colors.success : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isActive ? 0.25 : successMerge.value > 0.5 ? 0.5 : 0,
        shadowRadius: 8,
        elevation: isActive ? 3 : 0,
      };
    });

    const textStyle = useAnimatedStyle(() => ({
      opacity: interpolate(successMerge.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(successMerge.value, [0, 0.5], [1, 0], Extrapolation.CLAMP) }] as any,
    }));

    const caretStyle = useAnimatedStyle(() => ({ opacity: caretOpacity.value }));

    return (
      <Animated.View style={[styles.arm, armStyle]}>
        <Animated.View
          style={[styles.box, boxStyle]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {digit ? (
            <Animated.Text
              style={[styles.digit, hasError && styles.digitError, textStyle]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              allowFontScaling
            >
              {digit}
            </Animated.Text>
          ) : isActive && statusIdle ? (
            <Animated.View style={[styles.caret, caretStyle]} />
          ) : null}
        </Animated.View>
      </Animated.View>
    );
  }
);
OrbCell.displayName = 'OtpCodeFieldOrb';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPoint: {
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arm: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.011,
    color: 'transparent',
    fontSize: 1,
  },
  box: {
    position: 'absolute',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  digitError: {
    color: Colors.danger,
  },
  caret: {
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: Colors.primary,
  },
  checkmarkContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    marginTop: Spacing.sm + 4,
  },
  errorText: {
    flexShrink: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.danger,
    textAlign: 'center',
  },
});
