import React, { memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  AccessibilityInfo,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  interpolateColor,
  useReducedMotion,
  FadeIn,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';

interface OtpCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  /** Error message — turns cells red, shakes the row, and announces to screen readers. */
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Fires once each time the code reaches full length (re-armed when it shortens). */
  onComplete?: (code: string) => void;
  style?: StyleProp<ViewStyle>;
}

const CELL_BASE_HEIGHT = 56;
const CELL_MAX_WIDTH = 52;
const CELL_GAP = Spacing.sm;
const MAX_FONT_SCALE = 1.4;

/**
 * One-time-code entry built on a single invisible TextInput overlaying a row
 * of rendered cells. A single input (vs. six chained inputs) is what makes
 * OS-level code autofill, paste, backspace, and screen-reader focus behave
 * correctly on both platforms.
 */
export const OtpCodeField: React.FC<OtpCodeFieldProps> = ({
  value,
  onChange,
  length = 6,
  error,
  disabled = false,
  autoFocus = true,
  onComplete,
  style,
}) => {
  const inputRef = useRef<TextInput>(null);
  const lastSubmitted = useRef<string | null>(null);
  const prevError = useRef<string | null | undefined>(error);
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();

  const shakeX = useSharedValue(0);
  const [isFocused, setIsFocused] = React.useState(false);

  const cellHeight = Math.round(
    CELL_BASE_HEIGHT * Math.min(Math.max(fontScale, 1), MAX_FONT_SCALE)
  );

  const handleChangeText = (text: string) => {
    onChange(text.replace(/\D/g, '').slice(0, length));
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
    if (value !== lastSubmitted.current) {
      lastSubmitted.current = value;
      onComplete?.(value);
    }
  }, [value, length, onComplete]);

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

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const activeIndex = Math.min(value.length, length - 1);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  return (
    <View style={style}>
      <Animated.View style={[styles.row, shakeStyle]}>
        {digits.map((digit, i) => (
          <Cell
            key={i}
            digit={digit}
            isActive={isFocused && !disabled && i === activeIndex}
            hasError={!!error}
            height={cellHeight}
            reducedMotion={reducedMotion}
          />
        ))}
        {/* Invisible input covering the whole row: taps focus it, long-press
            offers Paste, and OS autofill lands in one place. */}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!disabled}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          // No maxLength: pasted codes may carry spaces/dashes ("123 456") and
          // would be truncated natively before onChangeText can sanitize them.
          caretHidden
          contextMenuHidden={false}
          style={styles.hiddenInput}
          accessibilityLabel={`Verification code. ${value.length} of ${length} digits entered.`}
          accessibilityHint="Enter the code you received"
        />
      </Animated.View>

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

// ─── Cell ─────────────────────────────────────────────────────────────────────

interface CellProps {
  digit: string;
  isActive: boolean;
  hasError: boolean;
  height: number;
  reducedMotion: boolean;
}

const Cell = memo<CellProps>(({ digit, isActive, hasError, height, reducedMotion }) => {
  const focus = useSharedValue(0);
  const caretOpacity = useSharedValue(1);

  useEffect(() => {
    focus.value = withTiming(isActive ? 1 : 0, { duration: Motion.duration.fast });
  }, [isActive, focus]);

  useEffect(() => {
    if (isActive && !digit && !reducedMotion) {
      caretOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1
      );
    } else {
      caretOpacity.value = 1;
    }
  }, [isActive, digit, reducedMotion, caretOpacity]);

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: hasError
      ? Colors.danger
      : interpolateColor(focus.value, [0, 1], [Colors.border, Colors.primary]),
    backgroundColor: hasError
      ? Colors.dangerSubtle
      : interpolateColor(focus.value, [0, 1], [Colors.surface, Colors.primarySubtle]),
    transform: [{ scale: reducedMotion ? 1 : 1 + focus.value * 0.04 }],
  }));

  const caretStyle = useAnimatedStyle(() => ({
    opacity: caretOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.cell,
        { height, borderWidth: isActive || hasError ? 2 : 1.5 },
        digit && !hasError && !isActive ? styles.cellFilled : null,
        boxStyle,
      ]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {digit ? (
        <Text
          style={[styles.digit, hasError && styles.digitError]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          allowFontScaling
        >
          {digit}
        </Text>
      ) : isActive ? (
        <Animated.View style={[styles.caret, caretStyle]} />
      ) : null}
    </Animated.View>
  );
});
Cell.displayName = 'OtpCodeFieldCell';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: CELL_GAP,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.011,
    color: 'transparent',
    fontSize: 1,
  },
  cell: {
    flex: 1,
    maxWidth: CELL_MAX_WIDTH,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFilled: {
    borderColor: Colors.borderStrong,
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
