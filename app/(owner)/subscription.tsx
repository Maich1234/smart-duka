import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { LoadingState } from '@/components/ui/LoadingState';
import { QueryError } from '@/components/ui/QueryError';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useSubscription, useInvalidateSubscription } from '@/hooks/useSubscription';
import { resendRenewalLink, type SubscriptionPlan } from '@/services/subscription';
import { useAlert } from '@/context/AlertContext';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { formatDate } from '@/utils/formatters';
import { describeSubscription } from '@/utils/subscriptionStatus';

const STATE_META = {
  none: { label: 'Not activated', color: Colors.textSecondary, bg: Colors.background, icon: 'gift-outline' as const },
  trialing: { label: 'Free trial', color: Colors.primaryDark, bg: Colors.primarySubtle, icon: 'sparkles-outline' as const },
  active: { label: 'Active', color: Colors.success, bg: Colors.successSubtle, icon: 'shield-checkmark-outline' as const },
  grace: { label: 'Payment due', color: '#92400E', bg: Colors.warningSubtle, icon: 'alert-circle-outline' as const },
  locked: { label: 'Paused', color: Colors.danger, bg: Colors.dangerSubtle, icon: 'lock-closed-outline' as const },
};

/**
 * Subscription **status**. Deliberately read-only.
 *
 * Google Play's payments policy requires Play Billing for in-app purchases
 * that unlock app functionality, and our subscription gates reports,
 * analytics, AI, and the lock screen. Rather than adopt Play Billing, this
 * app carries no purchase flow at all — the standard pattern for B2B SaaS on
 * Play (Xero, Zoho, Salesforce) — and billing lives entirely on the web app.
 *
 * Play's anti-steering rules go further than "no checkout": the app must not
 * link to, name, or direct users toward the external payment page either. So
 * this screen states where things stand and stops. Do not add a URL, a
 * Linking.openURL call, a "Manage online" button, or a QR code here.
 *
 * Renewal reminders reach owners through push notifications, the in-app
 * notification inbox, and email — channels *outside* the app binary, where
 * linking to checkout is permitted and where the renewal funnel now lives.
 *
 * The one exception below — "Resend payment link" — stays inside that rule:
 * it doesn't open or display a URL itself, it only asks the backend to
 * dispatch the same push + email a renewal reminder already sends. It exists
 * because an owner who dismissed that notification, or whose reminder
 * hasn't fired yet, had no way back to it before this.
 */
export default function SubscriptionScreen() {
  const tabBarHeight = useTabBarHeight();
  const { subscription, access, isLoading, isError, refetch } = useSubscription();
  const invalidate = useInvalidateSubscription();
  const { toast } = useAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [resending, setResending] = useState(false);

  const plan = (subscription?.plan ?? null) as SubscriptionPlan | null;
  const state = access?.state ?? 'none';
  const meta = STATE_META[state];
  // A zero-priced tier is a free *plan*, not a countdown to a purchase —
  // calling it a "trial" makes free-tier shops think they are about to lose
  // the app. The date still matters, so the countdown copy stays.
  const status = describeSubscription(access, plan);
  const trialLabel = status?.isFree ? 'free plan' : 'free trial';

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      invalidate();
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const onResendLink = async () => {
    if (resending) return;
    haptics.light();
    setResending(true);
    try {
      const res = await resendRenewalLink();
      toast({ type: res.emailSent === false ? 'warning' : 'success', message: res.message });
    } catch {
      toast({ type: 'error', message: 'Could not send the link right now. Check your connection and try again.' });
    } finally {
      setResending(false);
    }
  };

  if (isLoading) return <LoadingState />;
  // access is never undefined on a successful response (see SubscriptionAccess
  // in services/subscription.ts) — this is a real fetch failure, not a shop
  // with no subscription, and must not be told apart from STATE_META.none.
  if (isError || !access) return <QueryError onRetry={refetch} message="Could not load your subscription status. Check your connection and try again." />;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Animated.View entering={FadeInUp.duration(360)} style={styles.card}>
        <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={14} color={meta.color} />
          <Text style={[styles.statusChipText, { color: meta.color }]}>
            {state === 'trialing' && status?.isFree ? 'Free plan' : meta.label}
          </Text>
        </View>

        <Text style={styles.planName}>{plan?.name ?? 'No plan yet'}</Text>
        {plan?.tagline ? <Text style={styles.planTagline}>{plan.tagline}</Text> : null}

        {state === 'trialing' && access?.expiresAt && status && (
          <Text style={styles.detail}>
            Your {trialLabel} runs until {formatDate(access.expiresAt)},{' '}
            {status.daysLeft === 0
              ? 'today is the last day'
              : `${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} left`}
            .
          </Text>
        )}
        {state === 'active' && access?.expiresAt && (
          <Text style={styles.detail}>Renews on {formatDate(access.expiresAt)}.</Text>
        )}
        {state === 'grace' && (
          <Text style={styles.detail}>
            Your subscription has ended. Your shop keeps working for {access?.graceDaysLeft} more day
            {access?.graceDaysLeft === 1 ? '' : 's'}.
          </Text>
        )}
        {state === 'locked' && (
          <Text style={styles.detail}>
            Your subscription has ended and this shop is paused. Your data is safe and nothing has been
            deleted. Everything comes straight back when the subscription is renewed.
          </Text>
        )}
        {state === 'none' && (
          <Text style={styles.detail}>This shop doesn&apos;t have a subscription yet.</Text>
        )}
      </Animated.View>

      {(state === 'grace' || state === 'locked') && (
        <Animated.View entering={FadeInUp.duration(360).delay(40)} style={styles.noteCard}>
          <Ionicons name="link-outline" size={20} color={Colors.textSecondary} />
          <View style={styles.noteText}>
            <Text style={styles.noteTitle}>Pay from your email or notifications</Text>
            <Text style={styles.noteBody}>
              We sent a secure payment link to your email and to your notifications. Open either one and
              tap through to pay in your browser. It takes about a minute.
            </Text>
            <AnimatedPressable
              onPress={onResendLink}
              style={styles.resendBtn}
              accessibilityRole="button"
              accessibilityLabel="Resend payment link"
            >
              {resending ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={15} color={Colors.primary} />
                  <Text style={styles.resendBtnText}>Resend payment link</Text>
                </>
              )}
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => router.push('/(owner)/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
            >
              <Text style={styles.viewNotifText}>View in Notifications</Text>
            </AnimatedPressable>
          </View>
        </Animated.View>
      )}

      {/* Where billing is handled. Named as a fact about the account, with no
          link, address, or call to action — see the note on this component. */}
      <Animated.View entering={FadeInUp.duration(360).delay(80)} style={styles.noteCard}>
        <Ionicons name="desktop-outline" size={20} color={Colors.textSecondary} />
        <View style={styles.noteText}>
          <Text style={styles.noteTitle}>Billing is managed on the web</Text>
          <Text style={styles.noteBody}>
            Plans, payments, and receipts for this shop are handled from a browser, not the app. We email
            the shop owner a renewal reminder before every billing date.
          </Text>
        </View>
      </Animated.View>

      {subscription?.staffCount ? (
        <Animated.View entering={FadeInUp.duration(360).delay(140)} style={styles.card}>
          <Text style={styles.sectionLabel}>TEAM</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Billable people</Text>
            <Text style={styles.rowValue}>{subscription.staffCount}</Text>
          </View>
          <Text style={styles.footnote}>
            Adding or removing a team member adjusts the next bill automatically, prorated for the days
            left in the current period.
          </Text>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: Spacing.sm,
  },
  statusChipText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
  },
  planName: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  planTagline: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  detail: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.lg,
  },
  noteText: { flex: 1, gap: 4 },
  noteTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  noteBody: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    minHeight: 34,
    minWidth: 34,
  },
  resendBtnText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  viewNotifText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textDecorationLine: 'underline',
  },
  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: Typography.size.body, fontFamily: Typography.fontFamily, color: Colors.textSecondary },
  rowValue: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  footnote: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    lineHeight: 17,
    marginTop: Spacing.sm,
  },
});
