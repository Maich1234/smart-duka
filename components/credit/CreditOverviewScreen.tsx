import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useAuthStore } from '@/store/authStore';
import { getCreditOverview } from '@/services/credit';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';

/**
 * One of the four header figures. Compact — a number and a word, not a card —
 * and tappable straight into the pre-filtered customer list it summarises, so
 * a figure is a shortcut rather than a dead-end statistic.
 */
function StatFigure({
  label,
  value,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  tone?: 'danger';
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.figure}>
      <Text style={[styles.figureValue, tone === 'danger' && styles.figureValueDanger]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.figureLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <AnimatedPressable
      onPress={onPress}
      style={styles.figurePressable}
      pressScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      {content}
    </AnimatedPressable>
  );
}

/**
 * The owner's Credit section: what the shop is owed, what's overdue, and the
 * list that's actually actionable.
 *
 * Four figures in one row rather than four cards — a shop owner checking this
 * on a phone between customers needs the numbers in one glance, not a
 * dashboard to scroll. The overdue list below it is the only content that
 * earns space, because it's the only thing here with a next action attached.
 */
export const CreditOverviewScreen: React.FC = () => {
  const tabBarHeight = useTabBarHeight();
  const currency = useAuthStore((s) => s.user?.shop?.currency);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['creditOverview'],
    queryFn: () => getCreditOverview({ limit: 50 }),
  });

  const overview = data?.data;

  if (isLoading) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Credit" showBack={false} />
        <ListSkeleton rows={6} heroHeight={92} />
      </View>
    );
  }

  if (isError || !overview) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Credit" showBack={false} />
        <QueryError onRetry={refetch} />
      </View>
    );
  }

  if (!overview.enabled) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Credit" showBack={false} />
        <EmptyState
          title="Customer credit is off"
          subtitle="Turn it on in Settings to let staff sell on account and track what customers owe."
          actionLabel="Open Credit Settings"
          onAction={() => router.push('/(owner)/settings/credit' as never)}
        />
      </View>
    );
  }

  const { totals, overdue } = overview;
  const hasAnyDebt = totals.customersOwing > 0;

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Credit"
        showBack={false}
        right={
          <AnimatedPressable
            onPress={() => router.push('/(owner)/settings/credit' as never)}
            accessibilityRole="button"
            accessibilityLabel="Credit settings"
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
          </AnimatedPressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        <Animated.View entering={FadeInDown.duration(Motion.duration.slow)} style={styles.statsCard}>
          <StatFigure
            label="Outstanding"
            value={formatCurrency(totals.totalOutstanding, currency)}
            onPress={() => router.push('/(owner)/customers?filter=outstanding' as never)}
          />
          <View style={styles.figureDivider} />
          <StatFigure
            label="Overdue"
            value={formatCurrency(totals.totalOverdue, currency)}
            tone={totals.totalOverdue > 0 ? 'danger' : undefined}
            onPress={() => router.push('/(owner)/customers?filter=overdue' as never)}
          />
          <View style={styles.figureDivider} />
          <StatFigure
            label="Customers owing"
            value={String(totals.customersOwing)}
            onPress={() => router.push('/(owner)/customers?filter=outstanding' as never)}
          />
          <View style={styles.figureDivider} />
          <StatFigure
            label="Overdue"
            value={String(totals.customersOverdue)}
            tone={totals.customersOverdue > 0 ? 'danger' : undefined}
            onPress={() => router.push('/(owner)/customers?filter=overdue' as never)}
          />
        </Animated.View>

        <AnimatedPressable
          onPress={() => router.push('/(owner)/customers' as never)}
          style={styles.customersLink}
          accessibilityRole="button"
          accessibilityLabel="View all customers"
        >
          <Ionicons name="people-outline" size={17} color={Colors.primary} />
          <Text style={styles.customersLinkText}>View all customers</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() => router.push('/(owner)/credit/opening-balances' as never)}
          style={styles.importLink}
          accessibilityRole="button"
          accessibilityLabel="Bring forward a debt from before this shop tracked credit"
        >
          <Ionicons name="archive-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.importLinkText}>Bring forward a debt from before credit tracking</Text>
        </AnimatedPressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Overdue accounts</Text>
          {overdue.length > 0 && <Text style={styles.sectionCount}>{overdue.length}</Text>}
        </View>

        {overdue.length === 0 ? (
          <View style={styles.emptyOverdue}>
            <Ionicons name="checkmark-circle-outline" size={28} color={Colors.success} />
            <Text style={styles.emptyOverdueText}>
              {hasAnyDebt ? 'Nothing overdue right now.' : 'No outstanding credit yet.'}
            </Text>
          </View>
        ) : (
          <View style={styles.overdueList}>
            {overdue.map((c, i) => (
              <Animated.View
                key={c._id}
                entering={FadeInDown.duration(Motion.duration.slow).delay(Math.min(i, 6) * 45)}
              >
                <AnimatedPressable
                  onPress={() => router.push(`/(owner)/customers/${c._id}` as never)}
                  style={[styles.overdueRow, i < overdue.length - 1 && styles.overdueRowDivider]}
                  pressScale={Motion.press.scaleCard}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}, owes ${formatCurrency(c.outstanding, currency)}, ${c.daysOverdue} days overdue`}
                >
                  <View style={styles.overdueInfo}>
                    <Text style={styles.overdueName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.overdueMeta} numberOfLines={1}>
                      Due {c.dueAt ? formatDate(c.dueAt) : '—'} · {c.daysOverdue} day{c.daysOverdue === 1 ? '' : 's'} overdue
                    </Text>
                  </View>
                  <Text style={styles.overdueAmount}>{formatCurrency(c.outstanding, currency)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </AnimatedPressable>
              </Animated.View>
            ))}
          </View>
        )}

        {/* The overdue list above is capped (see the 50-row fetch limit) so
            this screen stays a glance, not a scroll — but a shop with more
            overdue accounts than that must be told the list is partial, not
            left assuming eleven overdue customers is the whole picture. */}
        {overview.pagination.total > overdue.length && (
          <AnimatedPressable
            onPress={() => router.push('/(owner)/customers?filter=overdue' as never)}
            style={styles.moreLink}
            accessibilityRole="button"
            accessibilityLabel={`View all ${overview.pagination.total} overdue accounts`}
          >
            <Text style={styles.moreLinkText}>
              View all {overview.pagination.total} overdue accounts
            </Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
          </AnimatedPressable>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
  },
  figure: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  figureValue: {
    fontSize: 17,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  figureValueDanger: { color: Colors.danger },
  figureLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  figureDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.divider },
  customersLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primarySubtle,
    borderRadius: BorderRadius.md,
  },
  customersLinkText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  importLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingVertical: 6,
  },
  importLinkText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionCount: {
    fontSize: Typography.size.caption,
    color: Colors.textTertiary,
  },
  emptyOverdue: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.successSubtle,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyOverdueText: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  overdueList: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    minHeight: 60,
  },
  overdueRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  overdueInfo: { flex: 1 },
  overdueName: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  overdueMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  overdueAmount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.danger,
    fontVariant: ['tabular-nums'],
  },
  figurePressable: { flex: 1 },
  moreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingVertical: 12,
  },
  moreLinkText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
});
