import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { PeriodSegmentControl } from '@/components/reports/PeriodSegmentControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { haptics } from '@/utils/haptics';
import {
  getCashierReconciliation,
  getMonthlyReconciliation,
  type CashierReconciliation,
  type ReconciliationPeriod,
} from '@/services/reconciliation';
import type { ReportPeriod } from '@/services/reports';
import { formatCurrency } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

/** PeriodSegmentControl speaks the reports trend vocabulary; reconciliation
 * needs the backend's single-window vocabulary instead. */
const toReconciliationPeriod = (p: ReportPeriod): ReconciliationPeriod =>
  p === 'weekly' ? 'week' : p === 'monthly' ? 'month' : 'day';

function DiscrepancyPill({ value, shiftsCount }: { value: number; shiftsCount: number }) {
  if (shiftsCount === 0) {
    return (
      <View style={[styles.pill, { backgroundColor: Colors.divider }]}>
        <Text style={[styles.pillText, { color: Colors.textTertiary }]}>NO CLOSED SHIFTS</Text>
      </View>
    );
  }
  const balanced = value === 0;
  const over = value > 0;
  return (
    <View style={[styles.pill, { backgroundColor: balanced ? Colors.successSubtle : over ? '#DBEAFE' : Colors.dangerSubtle }]}>
      <Text style={[styles.pillText, { color: balanced ? Colors.success : over ? Colors.info : Colors.danger }]}>
        {balanced ? 'BALANCED' : over ? `OVER ${formatCurrency(value)}` : `SHORT ${formatCurrency(Math.abs(value))}`}
      </Text>
    </View>
  );
}

function CashierCard({ cashier, index }: { cashier: CashierReconciliation; index: number }) {
  return (
    <Animated.View entering={FadeInUp.duration(350).delay(Math.min(index, 6) * 50)} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={15} color={Colors.primary} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.name}>{cashier.staffName}</Text>
          <Text style={styles.meta}>
            {cashier.shiftsCount} shift{cashier.shiftsCount === 1 ? '' : 's'} · {cashier.salesCount} sales
          </Text>
        </View>
        {cashier.unclosedCount > 0 && (
          <View style={[styles.pill, { backgroundColor: Colors.primarySubtle }]}>
            <Text style={[styles.pillText, { color: Colors.primary }]}>{cashier.unclosedCount} OPEN</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.stat}>
          <Text style={styles.statValue}>{formatCurrency(cashier.grossSales)}</Text> gross
        </Text>
        <Text style={styles.stat}>
          <Text style={styles.statValue}>{formatCurrency(cashier.byMethod.cash)}</Text> cash
        </Text>
        {cashier.voids.count > 0 && (
          <Text style={styles.stat}>
            <Text style={[styles.statValue, { color: Colors.danger }]}>{cashier.voids.count}</Text> voided
          </Text>
        )}
      </View>

      <View style={styles.drawerRow}>
        <Text style={styles.drawerLabel}>
          Expected {formatCurrency(cashier.expectedCashTotal)} · Counted {formatCurrency(cashier.actualCashTotal)}
        </Text>
        <DiscrepancyPill value={cashier.cashDiscrepancyTotal} shiftsCount={cashier.shiftsCount} />
      </View>
    </Animated.View>
  );
}

function CashiersSection() {
  const [period, setPeriod] = useState<ReportPeriod>('daily');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reconciliation-cashiers', period],
    queryFn: () => getCashierReconciliation({ period: toReconciliationPeriod(period) }),
    // Keep the current period's cashiers on screen while the next period
    // loads, instead of the list dropping to a skeleton on every tab tap.
    placeholderData: keepPreviousData,
  });

  const enabled = data?.enabled ?? true;
  const cashiers = data?.data.cashiers ?? [];

  return (
    <>
      <View style={styles.periodWrap}>
        <PeriodSegmentControl value={period} onChange={setPeriod} />
      </View>

      {isLoading && !data ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <QueryError onRetry={refetch} />
      ) : !enabled ? (
        <EmptyState
          title="Shift management is off"
          subtitle="Turn it on in Profile → Shop Features to have staff clock in and count the drawer — that's what powers this reconciliation."
        />
      ) : cashiers.length === 0 ? (
        <EmptyState title="No closed shifts yet" subtitle="Cashier reconciliation appears here once a shift is closed in this period." />
      ) : (
        cashiers.map((c, i) => <CashierCard key={c.staffId} cashier={c} index={i} />)
      )}
    </>
  );
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function MonthlySection() {
  const [monthDate, setMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const isCurrentMonth = monthKey(monthDate) === monthKey(new Date());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reconciliation-monthly', monthKey(monthDate)],
    // Date-only string, not monthDate.toISOString(): the backend parses this
    // as UTC, but toISOString() would first convert the device's *local*
    // midnight to UTC — for any shop east of UTC (Kenya, Uganda, Tanzania,
    // Rwanda...) that shifts the 1st back a day, so "August" would silently
    // fetch July's numbers.
    queryFn: () => getMonthlyReconciliation({ date: `${monthKey(monthDate)}-01` }),
    // Keep the current month's figures on screen while the next month loads,
    // instead of the whole card dropping to a skeleton on every month tap.
    placeholderData: keepPreviousData,
  });

  const changeMonth = (delta: number) => {
    haptics.selection();
    setMonthDate((cur) => {
      const next = new Date(cur.getFullYear(), cur.getMonth() + delta, 1);
      return monthKey(next) > monthKey(new Date()) ? cur : next;
    });
  };

  const d = data?.data;
  const netPositive = (d?.netCashPosition ?? 0) >= 0;
  const bars = [
    { key: 'Revenue', value: d?.revenue ?? 0, color: Colors.primary },
    { key: 'Expenses', value: d?.expenses ?? 0, color: Colors.danger },
    { key: 'Purchases', value: d?.purchases ?? 0, color: '#C8932A' },
  ];
  const maxBar = Math.max(1, ...bars.map((b) => b.value));

  return (
    <>
      <View style={styles.monthRow}>
        <AnimatedPressable onPress={() => changeMonth(-1)} style={styles.monthBtn} accessibilityRole="button" accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={18} color={Colors.textSecondary} />
        </AnimatedPressable>
        <Text style={styles.monthLabel}>
          {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <AnimatedPressable
          onPress={() => changeMonth(1)}
          disabled={isCurrentMonth}
          style={[styles.monthBtn, isCurrentMonth && styles.monthBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={18} color={isCurrentMonth ? Colors.textDisabled : Colors.textSecondary} />
        </AnimatedPressable>
      </View>

      {isLoading && !data ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <QueryError onRetry={refetch} />
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.statGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Revenue</Text>
                <Text style={styles.statTileValue}>{formatCurrency(d?.revenue ?? 0)}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Expenses</Text>
                <Text style={styles.statTileValue}>{formatCurrency(d?.expenses ?? 0)}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Purchases</Text>
                <Text style={styles.statTileValue}>{formatCurrency(d?.purchases ?? 0)}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Net Position</Text>
                <Text style={[styles.statTileValue, { color: netPositive ? Colors.success : Colors.danger }]}>
                  {formatCurrency(d?.netCashPosition ?? 0)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, styles.cardSpaced]}>
            <Text style={styles.sectionTitle}>SALES VS EXPENSES VS PURCHASES</Text>
            {bars.map((bar) => (
              <View key={bar.key} style={styles.barRow}>
                <Text style={styles.barLabel}>{bar.key}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(2, (bar.value / maxBar) * 100)}%`, backgroundColor: bar.color }]} />
                </View>
                <Text style={styles.barValue}>{formatCurrency(bar.value)}</Text>
              </View>
            ))}
          </View>

          {(d?.expensesByCategory.length ?? 0) > 0 && (
            <View style={[styles.card, styles.cardSpaced]}>
              <Text style={styles.sectionTitle}>EXPENSES BY CATEGORY</Text>
              {d!.expensesByCategory.map((c, i) => (
                <View key={c.category} style={[styles.categoryRow, i > 0 && styles.categoryRowBorder]}>
                  <Text style={styles.categoryLabel}>{c.category}</Text>
                  <Text style={styles.categoryValue}>{formatCurrency(c.total)}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </>
  );
}

export default function ReconciliationScreen() {
  const tabBarHeight = useTabBarHeight();
  const [tab, setTab] = useState<'cashiers' | 'monthly'>('cashiers');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.tabRow}>
        {(['cashiers', 'monthly'] as const).map((t) => (
          <AnimatedPressable
            key={t}
            onPress={() => { haptics.selection(); setTab(t); }}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'cashiers' ? 'Cashiers' : 'Month Financials'}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      {tab === 'cashiers' ? <CashiersSection /> : <MonthlySection />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  periodWrap: { marginBottom: Spacing.md },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  tabLabelActive: { color: Colors.white },

  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  monthBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnDisabled: { opacity: 0.4 },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statTile: { flexGrow: 1, flexBasis: '45%' },
  statLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  statTileValue: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },

  sectionTitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  barLabel: {
    width: 76,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: {
    minWidth: 76,
    textAlign: 'right',
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },

  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  categoryRowBorder: { borderTopWidth: 1, borderTopColor: Colors.divider },
  categoryLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  categoryValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  cardSpaced: { marginTop: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: { flex: 1 },
  name: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  stat: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  statValue: {
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  drawerLabel: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
});
