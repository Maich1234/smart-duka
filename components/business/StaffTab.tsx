import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Shimmer } from '@/components/ui/Shimmer';
import { QueryError } from '@/components/ui/QueryError';
import { PeriodFilter, ChipRow, type ChipOption } from './PeriodFilter';
import {
  SectionTitle, StatRow, Divider, Panel, BarList, InfoNote, money, type BarDatum,
} from './BusinessPrimitives';
import { getBusinessStaff, type StaffSort } from '@/services/business';
import type { BusinessTabProps } from './CollapsibleTabs.types';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const SORT_OPTIONS: ChipOption<StaffSort>[] = [
  { value: 'revenue', label: 'Sales amount' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'average', label: 'Average sale' },
];

/**
 * Sales attributed to each employee — the wording is the point.
 *
 * Revenue rung up on someone's account measures the till they stood at as
 * much as the person standing there: whoever works the busy morning outsells
 * the stockkeeper by arithmetic. DuQana records nothing about hours or floor
 * coverage, so this must not be presented, or read, as a productivity
 * ranking. Owner-only, like everything else on this screen.
 */
export const StaffTab: React.FC<BusinessTabProps> = ({ currency, period, onPeriodChange }) => {
  const [sort, setSort] = useState<StaffSort>('revenue');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['businessStaff', period, sort],
    queryFn: () => getBusinessStaff({ ...period, sort }),
    placeholderData: keepPreviousData,
  });

  const staff = data?.data;

  const bars: BarDatum[] = (staff?.staff ?? []).map((row) => ({
    id: row.staffId,
    label: row.name,
    value: sort === 'transactions' ? row.transactions : sort === 'average' ? row.averageSale : row.revenue,
    valueLabel:
      sort === 'transactions'
        ? `${row.transactions} sale${row.transactions === 1 ? '' : 's'}`
        : money(sort === 'average' ? row.averageSale : row.revenue, currency),
    caption:
      sort === 'transactions'
        ? `${money(row.revenue, currency)} · ${row.sharePercent}% of sales`
        : `${row.sharePercent}% of sales · ${row.transactions} sale${row.transactions === 1 ? '' : 's'}`,
  }));

  return (
    <View style={s.root}>
      <PeriodFilter value={period} onChange={onPeriodChange} />
      <View style={s.sortRow}>
        <ChipRow options={SORT_OPTIONS} value={sort} onChange={setSort} accessibilityLabel="Sort staff by" />
      </View>

      {isError && !staff ? (
        <QueryError onRetry={refetch} />
      ) : isLoading && !staff ? (
        <Shimmer height={220} borderRadius={BorderRadius.md} />
      ) : (
        <>
          <Panel>
            <StatRow label="Total sales" value={money(staff!.totals.revenue, currency)} emphasis />
            <Divider />
            <StatRow label="Transactions" value={String(staff!.totals.transactions)} />
            <Divider />
            <StatRow
              label="People who sold"
              value={String(staff!.totals.sellers)}
            />
          </Panel>

          <View style={s.gap} />
          <SectionTitle>Sales attributed to employee</SectionTitle>
          <BarList
            data={bars}
            ranked
            emptyMessage="No sales were recorded by anyone in this period."
          />

          {bars.length > 0 && (
            <>
              <View style={s.gap} />
              <InfoNote>
                This is what each person rang up. It depends on the shifts they worked as much as how they
                sold, so it is not a score on its own.
              </InfoNote>
            </>
          )}
        </>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root: { paddingTop: Spacing.lg },
  sortRow: { marginTop: Spacing.sm, marginBottom: Spacing.lg },
  gap: { marginTop: Spacing.xl },
});
