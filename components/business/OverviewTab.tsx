import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Shimmer } from '@/components/ui/Shimmer';
import { TrendChart } from '@/components/reports/TrendChart';
import { haptics } from '@/utils/haptics';
import {
  SectionTitle, StatRow, Divider, Panel, InfoNote, StandoutList, productStandouts, money,
} from './BusinessPrimitives';
import type { BusinessOverview } from '@/services/business';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface Props {
  overview?: BusinessOverview;
  currency?: string;
  onCapitalPress: () => void;
}

/**
 * The landing tab: the position, the day, the month's shape, and the three
 * products worth knowing about. Everything deeper is one tab away.
 */
export const OverviewTab: React.FC<Props> = ({ overview, currency, onCapitalPress }) => {
  if (!overview) return <OverviewSkeleton />;

  const { capital, inventory, today, month } = overview;

  return (
    <View style={s.root}>
      {/* ── Position ─────────────────────────────────────────────── */}
      <SectionTitle>Capital position</SectionTitle>
      <Panel>
        {capital.components.map((c, i) => (
          <View key={c.key}>
            {i > 0 && <Divider />}
            <StatRow
              label={c.label}
              value={c.recorded ? money(c.amount ?? 0, currency) : null}
            />
          </View>
        ))}
        <Divider />
        <StatRow label="Estimated position" value={money(capital.estimatedPosition, currency)} emphasis />
      </Panel>

      <AnimatedPressable
        onPress={() => { haptics.light(); onCapitalPress(); }}
        style={s.explainRow}
        accessibilityRole="button"
        accessibilityLabel="How is estimated capital worked out?"
      >
        <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
        <Text style={s.explainText}>How is this worked out?</Text>
      </AnimatedPressable>

      {/* ── Today ────────────────────────────────────────────────── */}
      <View style={s.gap} />
      <SectionTitle>Today</SectionTitle>
      <Panel>
        <StatRow label="Sales" value={money(today.total, currency)} emphasis />
        <Divider />
        <StatRow label="Transactions" value={String(today.transactions)} />
      </Panel>

      {/* ── This month ───────────────────────────────────────────── */}
      <View style={s.gap} />
      <SectionTitle>This month</SectionTitle>
      <Panel>
        <StatRow label="Sales" value={money(month.total, currency)} emphasis />
        <Divider />
        <StatRow label="Transactions" value={String(month.transactions)} />
        <Divider />
        <StatRow label="Average sale" value={money(month.averageSale, currency)} />
        <Divider />
        <StatRow
          label="Gross profit"
          sublabel={month.costEstimated ? 'Some costs are estimated' : undefined}
          value={money(month.grossProfit, currency)}
          tone={month.grossProfit >= 0 ? 'positive' : 'negative'}
        />
      </Panel>

      <View style={s.chartWrap}>
        <TrendChart series={month.series} emptyMessage="No sales yet this month" />
      </View>

      {/* ── Stock ────────────────────────────────────────────────── */}
      <View style={s.gap} />
      <SectionTitle hint="What your stock cost you, and what it would bring in at today's prices.">
        Stock
      </SectionTitle>
      <Panel>
        <StatRow label="Stock at cost" value={money(inventory.stockAtCost, currency)} emphasis />
        <Divider />
        <StatRow label="Potential sales value" value={money(inventory.potentialSalesValue, currency)} />
        <Divider />
        <StatRow
          label="Potential margin"
          value={money(inventory.potentialMargin, currency)}
          tone={inventory.potentialMargin >= 0 ? 'positive' : 'negative'}
        />
        <Divider />
        <StatRow
          label="Products"
          sublabel={inventory.lowStockCount > 0 ? `${inventory.lowStockCount} running low` : undefined}
          value={String(inventory.productCount)}
        />
      </Panel>

      {inventory.lowStockCount > 0 && (
        <AnimatedPressable
          onPress={() => { haptics.light(); router.push('/(owner)/inventory' as never); }}
          style={s.linkRow}
          accessibilityRole="button"
          accessibilityLabel={`${inventory.lowStockCount} products running low. Open inventory.`}
        >
          <Text style={s.linkText}>{`Review ${inventory.lowStockCount} low-stock product${inventory.lowStockCount === 1 ? '' : 's'}`}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </AnimatedPressable>
      )}

      {/* ── Standouts ────────────────────────────────────────────── */}
      <View style={s.gap} />
      <SectionTitle>This month&apos;s standouts</SectionTitle>
      <StandoutList
        items={productStandouts(month.highlights, currency)}
        emptyMessage="No sales recorded this month yet."
      />

      <View style={s.gap} />
      <InfoNote>
        Cancelled and refunded sales are left out. Each sale counts at the price and cost recorded on the day.
      </InfoNote>
    </View>
  );
};

const OverviewSkeleton: React.FC = () => (
  <View style={s.root}>
    <Shimmer height={14} borderRadius={4} style={{ width: '35%' }} />
    <View style={{ height: Spacing.sm }} />
    <Shimmer height={190} borderRadius={BorderRadius.md} />
    <View style={s.gap} />
    <Shimmer height={14} borderRadius={4} style={{ width: '25%' }} />
    <View style={{ height: Spacing.sm }} />
    <Shimmer height={110} borderRadius={BorderRadius.md} />
    <View style={s.gap} />
    <Shimmer height={160} borderRadius={BorderRadius.md} />
  </View>
);

const s = StyleSheet.create({
  root: { paddingTop: Spacing.lg },
  gap: { height: Spacing.xl },
  chartWrap: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.sm,
  },
  explainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingRight: Spacing.sm,
  },
  explainText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    minHeight: 48,
  },
  linkText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
});
