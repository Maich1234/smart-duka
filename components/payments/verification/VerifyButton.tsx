import React from 'react';
import { Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { haptics } from '@/utils/haptics';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';

export type VerifyButtonState = 'idle' | 'loading' | 'success';

interface VerifyButtonProps {
  state: VerifyButtonState;
  disabled: boolean;
  onPress: () => void;
}

const PRIMARY_GRADIENT = [Colors.primary, Colors.primaryLight] as const;
const SUCCESS_GRADIENT = [Colors.success, Colors.successLight] as const;
const DISABLED_GRADIENT = [Colors.disabledBackground, Colors.disabledBackground] as const;

/**
 * High-confidence CTA with distinct idle / loading / success presentations.
 * Success is announced by the parent (which owns the haptic + flow timing);
 * this component only renders state.
 */
export const VerifyButton: React.FC<VerifyButtonProps> = ({ state, disabled, onPress }) => {
  const reducedMotion = useReducedMotion();
  const isSuccess = state === 'success';
  const isLoading = state === 'loading';
  const isDisabled = disabled || isLoading || isSuccess;

  const handlePress = () => {
    haptics.medium();
    onPress();
  };

  const gradient = isSuccess
    ? SUCCESS_GRADIENT
    : disabled && !isLoading
      ? DISABLED_GRADIENT
      : PRIMARY_GRADIENT;

  return (
    <View style={[styles.shadow, (disabled || isSuccess) && styles.shadowMuted]}>
      <AnimatedPressable
        onPress={handlePress}
        disabled={isDisabled}
        style={styles.clip}
        accessibilityRole="button"
        accessibilityLabel={
          isSuccess ? 'Verified' : isLoading ? 'Verifying code' : 'Verify code'
        }
        accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.inner}
        >
          {isSuccess ? (
            <Animated.View
              entering={reducedMotion ? FadeIn.duration(Motion.duration.base) : ZoomIn.springify().damping(16)}
              style={styles.content}
            >
              <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
              <Text style={styles.label} maxFontSizeMultiplier={1.3}>
                Verified
              </Text>
            </Animated.View>
          ) : isLoading ? (
            <Animated.View entering={FadeIn.duration(Motion.duration.fast)} style={styles.content}>
              <ActivityIndicator size="small" color={Colors.white} />
              <Text style={styles.label} maxFontSizeMultiplier={1.3}>
                Verifying…
              </Text>
            </Animated.View>
          ) : (
            <View style={styles.content}>
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={disabled ? Colors.textDisabled : Colors.white}
              />
              <Text
                style={[styles.label, disabled && styles.labelDisabled]}
                maxFontSizeMultiplier={1.3}
              >
                Verify Code
              </Text>
            </View>
          )}
        </LinearGradient>
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  shadow: {
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  shadowMuted: {
    shadowOpacity: 0,
    elevation: 0,
  },
  clip: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  inner: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.white,
  },
  labelDisabled: {
    color: Colors.textDisabled,
  },
});
