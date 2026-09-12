import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Shimmer } from '@/components/ui/Shimmer';
import { Button } from '@/components/ui/Button';
import { QueryError } from '@/components/ui/QueryError';
import { haptics } from '@/utils/haptics';
import { formatQuantity } from '@/utils/formatters';
import { PeriodFilter, ChipRow, type ChipOption } from './PeriodFilter';
import {
  SectionTitle, StatRow, Divider, Panel, InfoNote, EmptyNote,
  StandoutList, productStandouts, money,
} from './BusinessPrimitives';
import {
  getBusinessProducts,
  type ProductSort,
  type ProductRow,
} from '@/services/business';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import type { BusinessTabProps } from './CollapsibleTabs.types';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const SORT_OPTIONS: ChipOption<ProductSort>[] = [
  { value: 'most_sold', label: 'Most sold' },
  { value: 'least_sold', label: 'Least sold' },
  { value: 'highest_revenue', label: 'Top revenue' },
  { value: 'lowest_revenue', label: 'Lowest revenue' },
  { value: 'highest_profit', label: 'Top profit' },
  { value: 'lowest_profit', label: 'Lowest profit' },
];

const PAGE_SIZE = 20;

/**
 * What sold, what didn't, and what each product actually made.
 *
 * Ranking, filtering and paging all happen in MongoDB — the device never
 * holds a shop's whole sales history to work out a monthly total. Rows are
 * collapsed to the metric being sorted on, and expand to the full
 * revenue/cost/profit/margin breakdown, because five figures per row is how
 * a useful list becomes an unreadable spreadsheet on a 360dp screen.
 */
export const ProductsTab: React.FC<BusinessTabProps> = ({ currency, period, onPeriodChange }) => {
  const [sort, setSort] = useState<ProductSort>('most_sold');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['businessProducts', period, sort],
    queryFn: ({ pageParam }) => getBusinessProducts({ ...period, sort, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.data.pagination.page < last.data.pagination.pages ? last.data.pagination.page + 1 : undefined,
  });

  const first = data?.pages[0]?.data;
  const rows = data?.pages.flatMap((p) => p.data.rows) ?? [];

  const toggle = useCallback((id: string) => {
    haptics.light();
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <View style={s.root}>
      <PeriodFilter value={period} onChange={onPeriodChange} />
      <View style={s.sortRow}>
        <ChipRow options={SORT_OPTIONS} value={sort} onChange={setSort} accessibilityLabel="Sort products by" />
      </View>

      {isError && !first ? (
        <QueryError onRetry={refetch} />
      ) : isLoading && !first ? (
        <Shimmer height={260} borderRadius={BorderRadius.md} />
      ) : (
        <>
          <Panel>
            <StatRow label="Revenue" value={money(first!.totals.revenue, currency)} emphasis />
            <Divider />
            <StatRow label="Cost of goods" value={money(first!.totals.cost, currency)} />
            <Divider />
            <StatRow
              label="Gross profit"
              value={money(first!.totals.grossProfit, currency)}
              tone={first!.totals.grossProfit >= 0 ? 'positive' : 'negative'}
            />
            <Divider />
            <StatRow
              label="Products sold"
              sublabel={`out of ${first!.totals.productCount} in your catalogue`}
              value={String(first!.totals.productsSold)}
            />
          </Panel>

          {first!.totals.costEstimated && (
            <View style={s.note}>
              <InfoNote tone="warning">
                Some sales here were recorded before DuQana saved the cost of each item. Their cost uses
                today&apos;s price instead, so profit is an estimate.
              </InfoNote>
            </View>
          )}

          <View style={s.gap} />
          <SectionTitle>Standouts</SectionTitle>
          <StandoutList
            items={productStandouts(first!.highlights, currency)}
            emptyMessage="No sales recorded in this period."
          />

          <View style={s.gap} />
          <SectionTitle>
            {SORT_OPTIONS.find((o) => o.value === sort)!.label}
          </SectionTitle>

          {rows.length === 0 ? (
            <EmptyNote>No products to show for this period.</EmptyNote>
          ) : (
            <View style={s.list}>
              {rows.map((row) => (
                <ProductListRow
                  key={row.productId}
                  row={row}
                  sort={sort}
                  currency={currency}
                  expanded={expandedId === row.productId}
                  onPress={() => toggle(row.productId)}
                />
              ))}
            </View>
          )}

          {hasNextPage && (
            <Button
              title={isFetchingNextPage ? 'Loading…' : 'Show more'}
              variant="outline"
              onPress={() => fetchNextPage()}
              loading={isFetchingNextPage}
              style={s.more}
            />
          )}
        </>
      )}
    </View>
  );
};

// ── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  row: ProductRow;
  sort: ProductSort;
  currency?: string;
  expanded: boolean;
  onPress: () => void;
}

/** The figure the current sort is ranking on — shown collapsed. */
const headlineFor = (row: ProductRow, sort: ProductSort, currency?: string) => {
  if (sort === 'most_sold' || sort === 'least_sold') return `${formatQuantity(row.units)} sold`;
  if (sort === 'highest_revenue' || sort === 'lowest_revenue') return money(row.revenue, currency);
  return money(row.grossProfit, currency);
};

/**
 * Memoized: `expandedId` lives on the tab, so without this every row in the
 * list re-renders each time one is opened — a visible hitch on the low-end
 * Android hardware PRODUCT.md targets, once the owner has paged in a few
 * hundred products.
 */
const ProductListRow: React.FC<RowProps> = React.memo(({ row, sort, currency, expanded, onPress }) => (
  <AnimatedPressable
    onPress={onPress}
    style={s.row}
    pressScale={0.995}
    accessibilityRole="button"
    accessibilityState={{ expanded }}
    accessibilityLabel={`${row.name}, ${headlineFor(row, sort, currency)}. ${expanded ? 'Hide' : 'Show'} full breakdown.`}
  >
    <View style={s.rowHeader}>
      <View style={s.rowTitleWrap}>
        <Text style={s.rowName} numberOfLines={1}>{row.name}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {`${formatQuantity(row.units)} units`}
          {/* A product added mid-period had fewer days to sell in. Saying so
              is what stops a three-day-old line being read as a failure. */}
          {!row.availableWholePeriod && ` · on sale ${row.availableDays} day${row.availableDays === 1 ? '' : 's'}`}
          {!row.inCatalogue && ' · removed from catalogue'}
        </Text>
      </View>
      <Text style={s.rowValue}>{headlineFor(row, sort, currency)}</Text>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={15}
        color={Colors.textSecondary}
      />
    </View>

    {expanded && (
      <Animated.View entering={FadeIn.duration(160)} style={s.rowDetail}>
        <Divider />
        <StatRow label="Units sold" value={formatQuantity(row.units)} />
        <StatRow label="Revenue" value={money(row.revenue, currency)} />
        <StatRow
          label="Cost"
          sublabel={row.costEstimated ? 'Estimated' : undefined}
          value={money(row.cost, currency)}
        />
        <StatRow
          label="Gross profit"
          value={money(row.grossProfit, currency)}
          tone={row.grossProfit >= 0 ? 'positive' : 'negative'}
        />
        <StatRow label="Margin" value={`${row.marginPercent}%`} />
        <StatRow label="In stock now" value={formatQuantity(row.stockOnHand)} />
      </Animated.View>
    )}
  </AnimatedPressable>
));
ProductListRow.displayName = 'ProductListRow';

const s = StyleSheet.create({
  root: { paddingTop: Spacing.lg },
  sortRow: { marginTop: Spacing.sm, marginBottom: Spacing.lg },
  gap: { marginTop: Spacing.xl },
  note: { marginTop: Spacing.md },
  list: { gap: Spacing.sm },
  row: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
  },
  rowTitleWrap: { flex: 1, gap: 2 },
  rowName: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  rowSub: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  rowValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  rowDetail: { marginTop: 2 },
  more: { marginTop: Spacing.lg },
});
