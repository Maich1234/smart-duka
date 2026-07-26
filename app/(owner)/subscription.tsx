import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LoadingState } from '@/components/ui/LoadingState';
import { useSubscription, useInvalidateSubscription } from '@/hooks/useSubscription';
import { type SubscriptionPlan } from '@/services/subscription';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { formatDate } from '@/utils/formatters';

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
 */
export default function SubscriptionScreen() {
  const { subscription, access, isLoading, refetch } = useSubscription();
  const invalidate = useInvalidateSubscription();
  const [refreshing, setRefreshing] = useState(false);

  const plan = (subscription?.plan ?? null) as SubscriptionPlan | null;
  const state = access?.state ?? 'none';
  const meta = STATE_META[state];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      invalidate();
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Animated.View entering={FadeInUp.duration(360)} style={styles.card}>
        <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={14} color={meta.color} />
          <Text style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        <Text style={styles.planName}>{plan?.name ?? 'No plan yet'}</Text>
        {plan?.tagline ? <Text style={styles.planTagline}>{plan.tagline}</Text> : null}

        {state === 'trialing' && access?.expiresAt && (
          <Text style={styles.detail}>
            Your free trial runs until {formatDate(access.expiresAt)} — {access.daysLeft} day
            {access.daysLeft === 1 ? '' : 's'} left.
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
            deleted — everything comes straight back when the subscription is renewed.
          </Text>
        )}
        {state === 'none' && (
          <Text style={styles.detail}>This shop doesn&apos;t have a subscription yet.</Text>
        )}
      </Animated.View>

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
