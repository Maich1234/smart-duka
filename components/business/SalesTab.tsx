import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Shimmer } from '@/components/ui/Shimmer';
import { QueryError } from '@/components/ui/QueryError';
import { TrendChart } from '@/components/reports/TrendChart';
import { PeriodFilter } from './PeriodFilter';
import { SectionTitle, StatRow, Divider, Panel, BarList, money, type BarDatum } from './BusinessPrimitives';
import { getBusinessSales } from '@/services/business';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import type { BusinessTabProps } from './CollapsibleTabs.types';

/**
 * Money in, for a period the owner chooses.
 *
 * The payment split is whatever buttons this shop actually uses — shops
 * define their own (Airtel Money, a bank account, a Pochi), so a hardcoded
 * cash/M-Pesa pair would quietly leave money out of the breakdown.
 */
export const SalesTab: React.FC<BusinessTabProps> = ({ currency, period, onPeriodChange }) => {

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['businessSales', period],
    queryFn: () => getBusinessSales(period),
    // The previous period stays on screen while the next one loads, instead
    // of the whole tab dropping to a skeleton on every chip tap.
    placeholderData: keepPreviousData,
  });

  const sales = data?.data;

  const methodBars: BarDatum[] = (sales?.byMethod ?? []).map((m) => ({
    id: m.key,
    label: m.label,
    value: m.total,
    valueLabel: money(m.total, currency),
    caption: `${m.sharePercent}% · ${m.transactions} sale${m.transactions === 1 ? '' : 's'}`,
  }));

  return (
    <View style={s.root}>
      <PeriodFilter value={period} onChange={onPeriodChange} />

      {isError && !sales ? (
        <QueryError onRetry={refetch} />
      ) : isLoading && !sales ? (
        <SalesSkeleton />
      ) : (
        <>
          <View style={s.gap} />
          <Panel>
            <StatRow label="Total sales" value={money(sales!.total, currency)} emphasis />
            <Divider />
            <StatRow label="Transactions" value={String(sales!.transactions)} />
            <Divider />
            <StatRow label="Average sale" value={money(sales!.averageSale, currency)} />
          </Panel>

          <View style={s.chartWrap}>
            <TrendChart series={sales!.series} emptyMessage="No sales in this period" />
          </View>

          <View style={s.gap} />
          <SectionTitle hint="How customers paid, across the buttons on your till.">
            Payment methods
          </SectionTitle>
          <BarList data={methodBars} emptyMessage="No sales in this period." />
        </>
      )}
    </View>
  );
};

const SalesSkeleton: React.FC = () => (
  <View style={s.gap}>
    <Shimmer height={150} borderRadius={BorderRadius.md} />
    <View style={{ height: Spacing.md }} />
    <Shimmer height={180} borderRadius={BorderRadius.md} />
  </View>
);

const s = StyleSheet.create({
  root: { paddingTop: Spacing.lg },
  gap: { marginTop: Spacing.lg },
  chartWrap: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.sm,
  },
});
