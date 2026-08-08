import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { PeriodSegmentControl } from '@/components/reports/PeriodSegmentControl';
import { TrendChart } from '@/components/reports/TrendChart';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { getPurchaseAnalytics } from '@/services/purchases';
import { formatCurrency } from '@/utils/formatters';
import { purchaseCostCategoryMeta } from '@/constants/purchaseCostCategories';
import type { ReportPeriod } from '@/services/reports';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const PERIOD_CAPTION: Record<ReportPeriod, string> = {
  daily: 'today',
  weekly: 'this week',
  monthly: 'this month',
};

interface SplitTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tint: string;
  tintBg: string;
}

const SplitTile: React.FC<SplitTileProps> = ({ icon, label, value, tint, tintBg }) => (
  <View style={styles.splitTile}>
    <View style={[styles.splitIconWrap, { backgroundColor: tintBg }]}>
      <Ionicons name={icon} size={15} color={tint} />
    </View>
    <Text style={styles.splitValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={styles.splitLabel} numberOfLines={2}>{label}</Text>
  </View>
);

interface RankRowProps {
  rank: number;
  title: string;
  subtitle: string;
  amount: string;
  /** 0–1 share of the largest row, drawn as a bar behind the text. */
  share: number;
  isLast: boolean;
}

const RankRow: React.FC<RankRowProps> = ({ rank, title, subtitle, amount, share, isLast }) => (
  <View style={[styles.rankRow, !isLast && styles.rowBorder]}>
    <View style={[styles.rankBar, { width: `${Math.max(share * 100, 2)}%` }]} />
    <Text style={styles.rankNumber}>{rank}</Text>
    <View style={styles.rankText}>
      <Text style={styles.rankTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.rankSub} numberOfLines={1}>{subtitle}</Text>
    </View>
    <Text style={styles.rankAmount}>{amount}</Text>
  </View>
);

/**
 * Procurement analytics — what the shop spent buying stock, split between the
 * goods themselves and the landed costs of getting them in. Mounted from both
 * (owner)/purchases/reports.tsx and (staff)/purchases/reports.tsx.
 *
 * The inventory/extra-cost split is the point of this screen: a shop that only
 * ever sees a single "spend" figure has no way to notice that transport is
 * quietly eating its margin.
 */
export function PurchaseReportsScreen() {
  const currency = useAuthStore((s: AuthState) => s.user?.shop?.currency);
  const tabBarHeight = useTabBarHeight();
  const canView = usePermission('view_purchases');
  // Every figure here is a cost, so the screen is meaningless without it.
  const canViewPrices = usePermission('view_purchase_prices');

  const [period, setPeriod] = useState<ReportPeriod>('monthly');

  const { data, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['purchaseAnalytics', period],
    queryFn: () => getPurchaseAnalytics({ period }),
    enabled: canView && canViewPrices,
    // Keep showing the current period's analytics while the next one loads,
    // instead of the whole screen dropping to a skeleton on every tab tap.
    placeholderData: keepPreviousData,
  });

  if (!canView || !canViewPrices) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="lock-closed-outline" size={40} color={Colors.textTertiary} />
        <Text style={styles.centerTitle}>No access</Text>
        <Text style={styles.centerSub}>
          {canView
            ? 'Purchase reports show cost prices, which you don’t have permission to see.'
            : 'Ask your shop owner to grant you purchasing access.'}
        </Text>
      </View>
    );
  }

  const analytics = data?.data;

  if (isLoading && !analytics) {
    return <ListSkeleton rows={4} heroHeight={180} />;
  }

  if (isError || !analytics) {
    return <QueryError onRetry={refetch} />;
  }

  const { summary, series, costBreakdown, topProducts, supplierSpend } = analytics;
  const hasSpend = summary.totalProcurementCost > 0;

  const costTotal = costBreakdown.reduce((sum, c) => sum + c.amount, 0);
  const topProductMax = Math.max(...topProducts.map((p) => p.totalCost), 1);
  const supplierMax = Math.max(...supplierSpend.map((s) => s.totalSpend), 1);

  // What share of every shilling spent went on getting goods in rather than on
  // the goods — the single number most worth acting on here.
  const overheadShare =
    summary.totalProcurementCost > 0
      ? Math.round((summary.totalAdditionalCosts / summary.totalProcurementCost) * 100)
      : 0;

  return (
    <ScrollView
      style={styles.flex}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
    >
      <View style={styles.section}>
        <PeriodSegmentControl value={period} onChange={setPeriod} />
      </View>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <LinearGradient
          colors={['#0A2318', '#0D4A38', '#0F766E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>TOTAL PROCUREMENT COST</Text>
          <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(summary.totalProcurementCost, currency)}
          </Text>
          <Text style={styles.heroSub}>
            Everything spent buying stock {PERIOD_CAPTION[period]}
          </Text>

          {hasSpend && (
            <>
              <View style={styles.heroDivider} />
              <View style={styles.heroSplit}>
                <View style={styles.heroSplitItem}>
                  <Text style={styles.heroSplitValue}>
                    {formatCurrency(summary.totalInventoryPurchased, currency)}
                  </Text>
                  <Text style={styles.heroSplitLabel}>Goods</Text>
                </View>
                <View style={styles.heroSplitSep} />
                <View style={styles.heroSplitItem}>
                  <Text style={styles.heroSplitValue}>
                    {formatCurrency(summary.totalAdditionalCosts, currency)}
                  </Text>
                  {/* Spelled out because the breakdown section below also shows
                      percentages, but of the extra costs rather than of total
                      spend — a bare "%" in both places invites misreading. */}
                  <Text style={styles.heroSplitLabel}>
                    Extra costs · {overheadShare}% of spend
                  </Text>
                </View>
              </View>
            </>
          )}
        </LinearGradient>
      </View>

      {!hasSpend ? (
        <View style={styles.section}>
          <View style={styles.card}>
            <EmptyState
              title={`No purchases ${PERIOD_CAPTION[period]}`}
              subtitle="Record a purchase, or pick a wider period, to see procurement analytics here."
            />
          </View>
        </View>
      ) : (
        <>
          {/* ── Averages ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.splitRow}>
              <SplitTile
                icon="cube-outline"
                label="Spent on goods"
                value={formatCurrency(summary.totalInventoryPurchased, currency)}
                tint={Colors.primary}
                tintBg={Colors.primarySubtle}
              />
              <SplitTile
                icon="car-outline"
                label="Extra costs"
                value={formatCurrency(summary.totalAdditionalCosts, currency)}
                tint={Colors.accentDark}
                tintBg={Colors.accentSubtle}
              />
              <SplitTile
                icon="calculator-outline"
                label="Average per purchase"
                value={formatCurrency(summary.averageProcurementCost, currency)}
                tint={Colors.info}
                tintBg="#DBEAFE"
              />
            </View>
          </View>

          {/* ── Trend ──────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SPEND OVER TIME</Text>
            <View style={styles.chartCard}>
              <TrendChart
                series={series.map((point) => ({
                  label: point.label,
                  date: point.date,
                  total: point.grandTotal,
                }))}
                emptyMessage={`No purchases ${PERIOD_CAPTION[period]}`}
              />
            </View>
          </View>

          {/* ── Extra-cost breakdown ───────────────────────────────── */}
          {costBreakdown.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                WHERE THE EXTRA COSTS WENT
              </Text>
              <Text style={styles.sectionHint}>
                Share of the {formatCurrency(summary.totalAdditionalCosts, currency)} above, not of
                total spend.
              </Text>
              <View style={styles.card}>
                {costBreakdown.map((entry, index) => {
                  const meta = purchaseCostCategoryMeta(entry.category);
                  const share = costTotal > 0 ? entry.amount / costTotal : 0;
                  return (
                    <View
                      key={entry.category}
                      style={[styles.costRow, index < costBreakdown.length - 1 && styles.rowBorder]}
                    >
                      <Ionicons name={meta.icon} size={16} color={Colors.textSecondary} />
                      <View style={styles.costText}>
                        <Text style={styles.costLabel}>{meta.label}</Text>
                        <View style={styles.costTrack}>
                          <View style={[styles.costFill, { width: `${Math.max(share * 100, 2)}%` }]} />
                        </View>
                      </View>
                      <View style={styles.costAmountWrap}>
                        <Text style={styles.costAmount}>{formatCurrency(entry.amount, currency)}</Text>
                        <Text style={styles.costShare}>{Math.round(share * 100)}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Top products ───────────────────────────────────────── */}
          {topProducts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>MOST BOUGHT PRODUCTS</Text>
              <View style={styles.card}>
                {topProducts.map((product, index) => (
                  <RankRow
                    key={product._id}
                    rank={index + 1}
                    title={product.productName}
                    subtitle={`${product.quantity} bought`}
                    amount={formatCurrency(product.totalCost, currency)}
                    share={product.totalCost / topProductMax}
                    isLast={index === topProducts.length - 1}
                  />
                ))}
              </View>
            </View>
          )}

          {/* ── Supplier spend ─────────────────────────────────────── */}
          {supplierSpend.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SPEND BY SUPPLIER</Text>
              <View style={styles.card}>
                {supplierSpend.map((supplier, index) => (
                  <RankRow
                    key={supplier._id ?? `walk-in-${index}`}
                    rank={index + 1}
                    title={supplier.supplierName || 'Walk-in purchases'}
                    subtitle={`${supplier.purchaseCount} purchase${supplier.purchaseCount === 1 ? '' : 's'}`}
                    amount={formatCurrency(supplier.totalSpend, currency)}
                    share={supplier.totalSpend / supplierMax}
                    isLast={index === supplierSpend.length - 1}
                  />
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: 8,
    backgroundColor: Colors.background,
  },
  centerTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 4,
  },
  centerSub: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  hero: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 2,
    ...Shadows.md,
  },
  heroLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: Typography.size.h1,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.white,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  heroSub: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: 'rgba(255,255,255,0.72)',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginVertical: 12,
  },
  heroSplit: { flexDirection: 'row', alignItems: 'center' },
  heroSplitItem: { flex: 1, gap: 2 },
  heroSplitSep: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginHorizontal: 12,
  },
  heroSplitValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.white,
    fontVariant: ['tabular-nums'],
  },
  heroSplitLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: 'rgba(255,255,255,0.72)',
  },

  splitRow: { flexDirection: 'row', gap: 10 },
  splitTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 6,
    ...Shadows.sm,
  },
  splitIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  splitLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 15,
  },

  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    lineHeight: 17,
    marginTop: -4,
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.sm,
    ...Shadows.sm,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },

  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 58,
  },
  costText: { flex: 1, gap: 6 },
  costLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  costTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  costFill: { height: 4, borderRadius: 2, backgroundColor: Colors.accent },
  costAmountWrap: { alignItems: 'flex-end', gap: 2 },
  costAmount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  costShare: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },

  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 56,
    overflow: 'hidden',
  },
  rankBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.primarySubtle,
  },
  rankNumber: {
    width: 18,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textTertiary,
  },
  rankText: { flex: 1, gap: 2 },
  rankTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  rankSub: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  rankAmount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
