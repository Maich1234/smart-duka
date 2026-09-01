import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { useSubscription } from '@/hooks/useSubscription';
import { describeSubscription } from '@/utils/subscriptionStatus';

/**
 * Owner-dashboard subscription nudge. Quiet by design: nothing during a
 * healthy trial or paid period — it only appears when the trial is inside
 * the reminder window, the shop is in its grace period, or no trial was
 * ever activated. Tapping opens the subscription screen.
 */
export const TrialBanner: React.FC = () => {
  const { access, plan, isLoading } = useSubscription();
  const status = describeSubscription(access, plan);
  if (isLoading || !access || !status) return null;

  let icon: keyof typeof Ionicons.glyphMap;
  let text: string;
  let tone: 'info' | 'warn' | 'urgent';

  if (access.state === 'none') {
    icon = 'gift-outline';
    text = 'Your free trial is waiting — activate DuQana.';
    tone = 'info';
  } else if (access.state === 'trialing' && status.daysLeft <= 7 && !access.cancelled) {
    icon = 'time-outline';
    // Free-tier shops aren't "on trial" — they're on a plan that runs out.
    const period = status.isFree ? 'free plan' : 'free trial';
    text =
      status.daysLeft === 0
        ? `Today is the last day of your ${period}.`
        : `${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} left in your ${period}.`;
    tone = status.daysLeft <= 3 ? 'warn' : 'info';
  } else if (access.state === 'grace') {
    icon = 'alert-circle-outline';
    text = `Subscription expired — ${access.graceDaysLeft} day${access.graceDaysLeft === 1 ? '' : 's'} left before your shop pauses.`;
    tone = 'urgent';
  } else if (access.state === 'locked') {
    icon = 'lock-closed-outline';
    text = 'Subscription expired — this shop is paused.';
    tone = 'urgent';
  } else {
    return null;
  }

  const palette = {
    info: { bg: Colors.primarySubtle, fg: Colors.primaryDark },
    warn: { bg: Colors.warningSubtle, fg: '#92400E' },
    urgent: { bg: Colors.dangerSubtle, fg: Colors.danger },
  }[tone];

  return (
    <AnimatedPressable
      onPress={() => {
        haptics.light();
        router.push('/(owner)/subscription');
      }}
      style={[styles.banner, { backgroundColor: palette.bg }]}
      accessibilityRole="button"
      accessibilityLabel="Open subscription"
    >
      <Ionicons name={icon} size={18} color={palette.fg} />
      <Text style={[styles.text, { color: palette.fg }]} numberOfLines={2}>
        {text}
      </Text>
      {/* "Activate" starts the free trial, which is not a purchase. Every
          other state opens the read-only status screen — no payment verb
          here, and nothing that steers toward an external checkout. */}
      <View style={[styles.cta, { borderColor: palette.fg }]}>
        <Text style={[styles.ctaText, { color: palette.fg }]}>
          {access.state === 'none' ? 'Activate' : 'View'}
        </Text>
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontFamily: Typography.fontFamilySemiBold,
  },
  cta: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ctaText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilyBold,
  },
});
