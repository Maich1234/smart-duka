import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { PeriodSegmentControl } from '@/components/reports/PeriodSegmentControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { getCashierReconciliation, type ReconciliationPeriod } from '@/services/reconciliation';
import type { ReportPeriod } from '@/services/reports';
import { formatCurrency } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const toReconciliationPeriod = (p: ReportPeriod): ReconciliationPeriod =>
  p === 'weekly' ? 'week' : p === 'monthly' ? 'month' : 'day';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function MyReconciliationScreen() {
  const tabBarHeight = useTabBarHeight();
  const [period, setPeriod] = useState<ReportPeriod>('daily');

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ['my-reconciliation', period],
    queryFn: () => getCashierReconciliation({ period: toReconciliationPeriod(period) }),
  });

  const enabled = data?.enabled ?? true;
  // The server scopes a non-owner caller to their own data regardless of any
  // staffId — this is always at most one row.
  const mine = data?.data.cashiers[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} colors={[Colors.primary]} />
      }
    >
      <View style={styles.periodWrap}>
        <PeriodSegmentControl value={period} onChange={setPeriod} />
      </View>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <QueryError onRetry={refetch} />
      ) : !enabled ? (
        <EmptyState
          title="Shift management is off"
          subtitle="Your shop hasn't switched this on, so there's no drawer to reconcile yet."
        />
      ) : !mine || mine.shiftsCount === 0 ? (
        <EmptyState
          title="No closed shifts yet"
          subtitle={mine && mine.unclosedCount > 0 ? 'You have a shift still open.' : 'Close a shift in this period to see your reconciliation.'}
        />
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>SALES</Text>
          <Row label={`Shifts (${mine.shiftsCount})`} value={`${mine.salesCount} sales`} />
          <Row label="Gross sales" value={formatCurrency(mine.grossSales)} />
          <Row label="Cash" value={formatCurrency(mine.byMethod.cash)} />
          <Row label="M-Pesa" value={formatCurrency(mine.byMethod.mpesa)} />
          {mine.byMethod.card > 0 && <Row label="Card" value={formatCurrency(mine.byMethod.card)} />}

          {(mine.refunds.count > 0 || mine.voids.count > 0) && (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>OUT</Text>
              {mine.refunds.count > 0 && (
                <Row label={`Refunds (${mine.refunds.count})`} value={`−${formatCurrency(mine.refunds.total)}`} />
              )}
              {mine.voids.count > 0 && (
                <Row label={`Voided (${mine.voids.count})`} value={`−${formatCurrency(mine.voids.total)}`} />
              )}
            </>
          )}

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>DRAWER</Text>
          <Row label="Expected cash" value={formatCurrency(mine.expectedCashTotal)} />
          <Row label="Counted" value={formatCurrency(mine.actualCashTotal)} />

          <View
            style={[
              styles.verdict,
              { backgroundColor: mine.cashDiscrepancyTotal === 0 ? Colors.successSubtle : '#FEF3C7' },
            ]}
          >
            <Text style={[styles.verdictLabel, { color: mine.cashDiscrepancyTotal === 0 ? Colors.success : '#92400E' }]}>
              {mine.cashDiscrepancyTotal === 0 ? 'Balanced' : mine.cashDiscrepancyTotal > 0 ? 'Over by' : 'Short by'}
            </Text>
            <Text style={[styles.verdictValue, { color: mine.cashDiscrepancyTotal === 0 ? Colors.success : '#92400E' }]}>
              {formatCurrency(Math.abs(mine.cashDiscrepancyTotal))}
            </Text>
          </View>

          {mine.unclosedCount > 0 && (
            <Text style={styles.footnote}>
              You have {mine.unclosedCount} shift{mine.unclosedCount > 1 ? 's' : ''} still open, not counted above.
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  periodWrap: { marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  sectionTitleSpaced: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  rowValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    marginTop: Spacing.sm,
  },
  verdictLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  verdictValue: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
