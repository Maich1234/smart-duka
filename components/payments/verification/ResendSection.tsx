import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';

interface ResendSectionProps {
  /** Cooldown length in seconds; remount (via key) to restart the countdown. */
  cooldownSeconds: number;
  sending: boolean;
  disabled: boolean;
  onResend: () => void;
}

/**
 * Countdown → "Resend code" action. Owns its own 1s tick so the rest of the
 * modal tree doesn't re-render every second.
 */
export const ResendSection: React.FC<ResendSectionProps> = ({
  cooldownSeconds,
  sending,
  disabled,
  onResend,
}) => {
  const [remaining, setRemaining] = useState(cooldownSeconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.wrap}>
      <Text style={styles.question} maxFontSizeMultiplier={1.6}>
        {"Didn't receive a code?"}
      </Text>
      {remaining > 0 ? (
        <View style={styles.countdownRow} accessibilityLiveRegion="polite">
          <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.countdownText} maxFontSizeMultiplier={1.6}>
            Resend available in {remaining}s
          </Text>
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(Motion.duration.base)}>
          <AnimatedPressable
            onPress={onResend}
            disabled={disabled || sending}
            style={styles.resendBtn}
            accessibilityRole="button"
            accessibilityLabel="Resend verification code"
            accessibilityState={{ disabled: disabled || sending, busy: sending }}
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={14} color={Colors.primary} />
            )}
            <Text style={styles.resendText} maxFontSizeMultiplier={1.6}>
              {sending ? 'Sending…' : 'Resend Code'}
            </Text>
          </AnimatedPressable>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  question: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 32,
  },
  countdownText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.sm - 2,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primarySubtle,
    borderRadius: BorderRadius.full,
    minHeight: 32,
  },
  resendText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
});
