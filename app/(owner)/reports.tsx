import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LoadingState } from '@/components/ui/LoadingState';
import { useQuery } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getSalesReport, type ReportPeriod } from '@/services/reports';
import { getRatingsSummary } from '@/services/ratings';
import { getDepletionAnalytics } from '@/services/analytics';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { Section } from '@/components/ui/Section';
import { ListRow } from '@/components/ui/ListRow';
import { TrendChart } from '@/components/reports/TrendChart';
import { HelpLink } from '@/components/help/HelpLink';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';
import { formatCurrency } from '@/utils/formatters';

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function OwnerReports() {
  const tabBarHeight = useBottomTabBarHeight();
  const user = useAuthStore((s: AuthState) => s.user);
  const currency = user?.shop?.currency;
  const [period, setPeriod] = useState<ReportPeriod>('daily');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['salesReport', period],
    queryFn: () => getSalesReport(period),
  });

  const { data: ratingsData } = useQuery({
    queryKey: ['ratingsSummary'],
    queryFn: getRatingsSummary,
  });

  const { data: depletionData } = useQuery({
    queryKey: ['depletionAnalytics'],
    queryFn: () => getDepletionAnalytics(),
  });

  const report = data?.data;
  const ratingsSummary = ratingsData?.data;
  const depletion = depletionData?.data;

  if (isLoading) {
    return <LoadingState />;
  }

  const series = report?.series || [];

  return (
    <Animated.ScrollView
      entering={FadeIn.duration(Motion.duration.slow)}
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: Spacing.lg, paddingBottom: tabBarHeight + Spacing.lg }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <Text style={styles.title}>Sales Reports</Text>

      <View style={styles.periodToggle}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.periodBtn, period === p.value && styles.periodBtnActive]}
            onPress={() => setPeriod(p.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.periodBtnText, period === p.value && styles.periodBtnTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Total Revenue</Text>
        <Text style={styles.heroValue}>{formatCurrency(report?.summary.totalRevenue || 0, currency)}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{report?.summary.totalTransactions || 0}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
        <View style={[styles.statCell, styles.statCellDivider]}>
          <Text style={styles.statValue}>{formatCurrency(report?.summary.averageSale || 0, currency)}</Text>
          <Text style={styles.statLabel}>Avg. Sale</Text>
        </View>
        <View style={styles.statCell}>
          <Text
            style={[
              styles.statValue,
              styles.netProfitPositive,
              (report?.summary.netProfit || 0) < 0 && styles.netProfitNegative,
            ]}
          >
            {formatCurrency(report?.summary.netProfit || 0, currency)}
          </Text>
          <Text style={styles.statLabel}>Net Profit</Text>
        </View>
      </View>

      <View style={styles.paymentSplit}>
        <View style={styles.paymentItem}>
          <View style={[styles.dot, { backgroundColor: Colors.success }]} />
          <Text style={styles.paymentText}>Cash {formatCurrency(report?.summary.cashTotal || 0, currency)}</Text>
        </View>
        <View style={styles.paymentItem}>
          <View style={[styles.dot, { backgroundColor: Colors.info }]} />
          <Text style={styles.paymentText}>M-Pesa {formatCurrency(report?.summary.mpesaTotal || 0, currency)}</Text>
        </View>
      </View>

      <ListRow
        title="View & record expenses"
        icon="cash-outline"
        chevron
        isLast
        style={styles.expensesLink}
        onPress={() => router.push('/(owner)/expenses')}
      />

      <Section title="Trend">
        <TrendChart series={series} />
      </Section>

      <Section title="Top Products">
        {(report?.topProducts.length || 0) === 0 ? (
          <Text style={styles.empty}>No sales in this period</Text>
        ) : (
          report?.topProducts.map((p, i) => (
            <ListRow
              key={p.productName}
              title={p.productName}
              subtitle={`${p.quantitySold} sold`}
              trailing={<Text style={styles.rowValue}>{formatCurrency(p.revenue, currency)}</Text>}
              isLast={i === report.topProducts.length - 1}
            />
          ))
        )}
      </Section>

      <Section title="By Staff">
        {(report?.byStaff.length || 0) === 0 ? (
          <Text style={styles.empty}>No sales in this period</Text>
        ) : (
          report?.byStaff.map((s, i) => (
            <ListRow
              key={s.staffName}
              title={s.staffName}
              subtitle={`${s.transactionCount} sales`}
              trailing={<Text style={styles.rowValue}>{formatCurrency(s.total, currency)}</Text>}
              isLast={i === report.byStaff.length - 1}
            />
          ))
        )}
      </Section>

      <Section title="Customer Ratings" action={<HelpLink slug="receipts-and-ratings" />}>
        {!ratingsSummary || ratingsSummary.totalRatings === 0 ? (
          <Text style={styles.empty}>No customer ratings yet</Text>
        ) : (
          <>
            <View style={styles.ratingHeader}>
              <Text style={styles.ratingAvg}>{ratingsSummary.avgStars.toFixed(1)}</Text>
              <View>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={s <= Math.round(ratingsSummary.avgStars) ? 'star' : 'star-outline'}
                      size={16}
                      color={Colors.warning}
                    />
                  ))}
                </View>
                <Text style={styles.ratingCount}>{ratingsSummary.totalRatings} ratings</Text>
              </View>
            </View>

            {ratingsSummary.byStaff.map((s, i) => (
              <ListRow
                key={s.staffId}
                title={s.staffName}
                subtitle={`${s.totalRatings} ratings`}
                trailing={<Text style={styles.rowValue}>{s.avgStars.toFixed(1)} ★</Text>}
                isLast={i === ratingsSummary.byStaff.length - 1}
              />
            ))}
          </>
        )}
      </Section>

      <Section title="Stock Velocity" action={<HelpLink slug="sales-reports" />}>
        {!depletion || (depletion.fastMovers.length === 0 && depletion.slowMovers.length === 0) ? (
          <Text style={styles.empty}>Not enough sales history yet</Text>
        ) : (
          <>
            {depletion.fastMovers.length > 0 && (
              <>
                <Text style={styles.subLabel}>Fast Movers</Text>
                {depletion.fastMovers.slice(0, 5).map((p, i, arr) => (
                  <ListRow
                    key={p.productId}
                    title={p.name}
                    subtitle={`${p.avgDailyVelocity.toFixed(1)}/day`}
                    trailing={
                      <Text style={styles.rowValue}>
                        {p.daysUntilStockout != null ? `${Math.round(p.daysUntilStockout)}d left` : '—'}
                      </Text>
                    }
                    isLast={i === arr.length - 1 && depletion.slowMovers.length === 0}
                  />
                ))}
              </>
            )}
            {depletion.slowMovers.length > 0 && (
              <>
                <Text style={[styles.subLabel, depletion.fastMovers.length > 0 && styles.subLabelSpaced]}>
                  Slow Movers
                </Text>
                {depletion.slowMovers.slice(0, 5).map((p, i, arr) => (
                  <ListRow
                    key={p.productId}
                    title={p.name}
                    subtitle={`${p.avgDailyVelocity.toFixed(2)}/day`}
                    trailing={<Text style={styles.rowValue}>{p.quantity} in stock</Text>}
                    isLast={i === arr.length - 1}
                  />
                ))}
              </>
            )}
          </>
        )}
      </Section>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginBottom: Spacing.md },

  periodToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.sm },
  periodBtnActive: { backgroundColor: Colors.primary },
  periodBtnText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary },
  periodBtnTextActive: { color: Colors.white },

  hero: { marginBottom: Spacing.md },
  heroLabel: { fontSize: Typography.size.small, color: Colors.textSecondary },
  heroValue: { fontSize: Typography.size.display, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginTop: 2 },

  statsRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.divider,
    marginBottom: Spacing.md,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statCellDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.divider },
  statValue: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  netProfitPositive: { color: Colors.accentDark },
  netProfitNegative: { color: Colors.danger },
  statLabel: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },

  paymentSplit: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.lg },
  paymentItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: 8, height: 8, borderRadius: BorderRadius.xs },
  paymentText: { fontSize: Typography.size.small, color: Colors.textSecondary },

  expensesLink: { marginBottom: Spacing.lg },

  empty: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.sm },

  rowValue: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },

  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    marginBottom: Spacing.xs,
  },
  ratingAvg: { fontSize: Typography.size.display, fontFamily: Typography.fontFamilyBold, color: Colors.accentDark },
  starRow: { flexDirection: 'row', gap: 2 },
  ratingCount: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 4 },

  subLabel: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  subLabelSpaced: { marginTop: Spacing.sm },
});
