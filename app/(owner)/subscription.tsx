import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { SubscriptionPayModal } from '@/components/subscription/SubscriptionPayModal';
import { useSubscription, useInvalidateSubscription } from '@/hooks/useSubscription';
import { activateTrial, cancelSubscription, type SubscriptionPlan } from '@/services/subscription';
import { useAuthStore } from '@/store/authStore';
import { useAlert } from '@/context/AlertContext';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency, formatDate } from '@/utils/formatters';

const STATE_META = {
  none: { label: 'Not activated', color: Colors.textSecondary, bg: Colors.background, icon: 'gift-outline' as const },
  trialing: { label: 'Free trial', color: Colors.primaryDark, bg: Colors.primarySubtle, icon: 'sparkles-outline' as const },
  active: { label: 'Active', color: Colors.success, bg: Colors.successSubtle, icon: 'shield-checkmark-outline' as const },
  grace: { label: 'Payment due', color: '#92400E', bg: Colors.warningSubtle, icon: 'alert-circle-outline' as const },
  locked: { label: 'Paused', color: Colors.danger, bg: Colors.dangerSubtle, icon: 'lock-closed-outline' as const },
};

/**
 * Subscription management — and, when the grace period runs out, the
 * paywall itself: the owner layout redirects every tab here while the shop
 * is locked, so paying via M-PESA is the only way forward.
 */
export default function SubscriptionScreen() {
  const user = useAuthStore((s) => s.user);
  const { subscription, access, renewal, isLoading, refetch } = useSubscription();
  const invalidate = useInvalidateSubscription();
  const { alert, toast } = useAlert();
  const [payVisible, setPayVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const plan = (subscription?.plan ?? null) as SubscriptionPlan | null;
  const state = access?.state ?? 'none';
  const meta = STATE_META[state];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const startTrial = async () => {
    if (working) return;
    haptics.medium();
    setWorking(true);
    try {
      const res = await activateTrial();
      toast({ type: 'success', message: res.message });
      invalidate();
    } catch (err: any) {
      toast({ type: 'error', message: err?.response?.data?.message ?? 'Could not activate the trial. Try again.' });
    } finally {
      setWorking(false);
    }
  };

  const confirmCancel = () => {
    alert({
      type: 'confirm',
      title: 'Cancel subscription?',
      message: 'You keep full access until the end of your current period. You can re-subscribe anytime.',
      buttons: [
        { label: 'Keep subscription', variant: 'secondary' },
        {
          label: 'Cancel subscription',
          variant: 'danger',
          onPress: async () => {
            try {
              const res = await cancelSubscription();
              toast({ type: 'success', message: res.message });
              invalidate();
            } catch (err: any) {
              toast({ type: 'error', message: err?.response?.data?.message ?? 'Could not cancel. Try again.' });
            }
          },
        },
      ],
    });
  };

  if (isLoading && !subscription) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const expiresAt = access?.expiresAt ? formatDate(access.expiresAt) : null;
  const canPay = !!renewal && (state === 'trialing' || state === 'grace' || state === 'locked' || state === 'active');

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {state === 'locked' && (
          <Animated.View entering={FadeInUp.duration(360)} style={styles.lockedCard}>
            <Ionicons name="lock-closed" size={22} color={Colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lockedTitle}>Your shop is paused</Text>
              <Text style={styles.lockedSub}>
                Your subscription and grace period have ended. Pay below to pick
                up right where you left off — all your data is safe.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Status card */}
        <Animated.View entering={FadeInUp.duration(360).delay(60)} style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon} size={14} color={meta.color} />
              <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            {access?.cancelled && (
              <Text style={styles.cancelledNote}>Cancelled — active until period end</Text>
            )}
          </View>

          <Text style={styles.planName}>{plan?.name ? `${plan.name} plan` : 'Smart Duka'}</Text>
          {!!plan?.tagline && <Text style={styles.planTagline}>{plan.tagline}</Text>}

          <View style={styles.divider} />

          {state === 'trialing' && (
            <InfoRow icon="time-outline" label="Trial ends" value={`${expiresAt} · ${access?.daysLeft} day${access?.daysLeft === 1 ? '' : 's'} left`} />
          )}
          {state === 'active' && (
            <InfoRow icon="refresh-outline" label={access?.cancelled ? 'Access until' : 'Renews'} value={expiresAt ?? '—'} />
          )}
          {state === 'grace' && (
            <InfoRow
              icon="alert-circle-outline"
              label="Grace period"
              value={`${access?.graceDaysLeft} day${access?.graceDaysLeft === 1 ? '' : 's'} left to pay`}
            />
          )}
          {renewal && (
            <InfoRow
              icon="people-outline"
              label="Team size"
              value={`${renewal.staffCount} ${renewal.staffCount === 1 ? 'person' : 'people'}`}
            />
          )}
          {renewal && (
            <InfoRow
              icon="card-outline"
              label={renewal.billingCycle === 'yearly' ? 'Yearly price' : 'Monthly price'}
              value={formatCurrency(renewal.amountDue, renewal.currency)}
            />
          )}

          {state === 'none' && (
            <>
              <Text style={styles.noneNote}>
                Your free trial is waiting. Activate it now — no payment needed
                to start.
              </Text>
              <Button title="Activate free trial" onPress={startTrial} loading={working} style={{ alignSelf: 'stretch' }} />
            </>
          )}

          {canPay && (
            <Button
              title={state === 'active' ? `Extend now · ${formatCurrency(renewal!.amountDue, renewal!.currency)}` : `Pay with M-PESA · ${formatCurrency(renewal!.amountDue, renewal!.currency)}`}
              onPress={() => {
                haptics.medium();
                setPayVisible(true);
              }}
              style={{ alignSelf: 'stretch' }}
            />
          )}
        </Animated.View>

        {/* Cancel */}
        {subscription && subscription.status !== 'cancelled' && state !== 'locked' && (
          <Animated.View entering={FadeInUp.duration(360).delay(120)}>
            <AnimatedPressable onPress={confirmCancel} style={styles.cancelRow} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel subscription</Text>
            </AnimatedPressable>
          </Animated.View>
        )}
      </ScrollView>

      <SubscriptionPayModal
        visible={payVisible}
        amount={renewal?.amountDue ?? 0}
        currency={renewal?.currency ?? 'KES'}
        billingCycle={renewal?.billingCycle ?? 'monthly'}
        planSlug={renewal?.planSlug}
        defaultPhone={user?.shop?.phone}
        onClose={() => setPayVisible(false)}
        onSuccess={() => {
          setPayVisible(false);
          invalidate();
        }}
      />
    </View>
  );
}

const InfoRow: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={16} color={Colors.textTertiary} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: 120 },
  lockedCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerSubtle,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  lockedTitle: {
    color: Colors.danger,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
  },
  lockedSub: {
    color: '#7F1D1D',
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilyBold,
  },
  cancelledNote: {
    color: Colors.textTertiary,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
  },
  planName: {
    color: Colors.textPrimary,
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
  },
  planTagline: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.md },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    flex: 1,
  },
  infoValue: {
    color: Colors.textPrimary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  noneNote: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    lineHeight: Typography.lineHeight.small,
    fontFamily: Typography.fontFamily,
    marginBottom: Spacing.md,
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  cancelText: {
    color: Colors.danger,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
