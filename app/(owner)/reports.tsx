import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { getSalesReport, type ReportPeriod } from '@/services/reports';
import { getRatingsSummary } from '@/services/ratings';
import { getDepletionAnalytics } from '@/services/analytics';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { formatCurrency } from '@/utils/formatters';

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const MAX_BAR_HEIGHT = 120;

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
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const series = report?.series || [];
  const maxTotal = Math.max(...series.map((b) => b.total), 1);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: Spacing.md, paddingBottom: tabBarHeight + Spacing.lg }}
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

      <Card style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Revenue</Text>
        <Text style={styles.summaryValue}>{formatCurrency(report?.summary.totalRevenue || 0, currency)}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryStat}>
            <Text style={styles.statValue}>{report?.summary.totalTransactions || 0}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.statValue}>{formatCurrency(report?.summary.averageSale || 0, currency)}</Text>
            <Text style={styles.statLabel}>Avg. Sale</Text>
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
      </Card>

      <Text style={styles.sectionTitle}>Trend</Text>
      <Card style={styles.chartCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
          {series.map((bucket) => (
            <View key={bucket.date} style={styles.barColumn}>
              <Text style={styles.barValue}>{bucket.total > 0 ? Math.round(bucket.total) : ''}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max((bucket.total / maxTotal) * MAX_BAR_HEIGHT, bucket.total > 0 ? 4 : 0) },
                  ]}
                />
              </View>
              <Text style={styles.barLabel} numberOfLines={1}>{bucket.label}</Text>
            </View>
          ))}
        </ScrollView>
      </Card>

      <Text style={styles.sectionTitle}>Top Products</Text>
      <Card style={styles.listCard}>
        {(report?.topProducts.length || 0) === 0 ? (
          <Text style={styles.empty}>No sales in this period</Text>
        ) : (
          report?.topProducts.map((p, i) => (
            <View key={p.productName} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
              <View style={styles.listRowInfo}>
                <Text style={styles.listRowTitle} numberOfLines={1}>{p.productName}</Text>
                <Text style={styles.listRowSubtitle}>{p.quantitySold} sold</Text>
              </View>
              <Text style={styles.listRowValue}>{formatCurrency(p.revenue, currency)}</Text>
            </View>
          ))
        )}
      </Card>

      <Text style={styles.sectionTitle}>By Staff</Text>
      <Card style={styles.listCard}>
        {(report?.byStaff.length || 0) === 0 ? (
          <Text style={styles.empty}>No sales in this period</Text>
        ) : (
          report?.byStaff.map((s, i) => (
            <View key={s.staffName} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
              <View style={styles.listRowInfo}>
                <Text style={styles.listRowTitle} numberOfLines={1}>{s.staffName}</Text>
                <Text style={styles.listRowSubtitle}>{s.transactionCount} sales</Text>
              </View>
              <Text style={styles.listRowValue}>{formatCurrency(s.total, currency)}</Text>
            </View>
          ))
        )}
      </Card>

      <Text style={styles.sectionTitle}>Customer Ratings</Text>
      <Card style={styles.summaryCard}>
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

            {ratingsSummary.byStaff.length > 0 && (
              <View style={styles.staffRatings}>
                {ratingsSummary.byStaff.map((s, i) => (
                  <View key={s.staffId} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
                    <View style={styles.listRowInfo}>
                      <Text style={styles.listRowTitle} numberOfLines={1}>{s.staffName}</Text>
                      <Text style={styles.listRowSubtitle}>{s.totalRatings} ratings</Text>
                    </View>
                    <Text style={styles.listRowValue}>{s.avgStars.toFixed(1)} ★</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Stock Velocity</Text>
      <Card style={styles.listCard}>
        {!depletion || (depletion.fastMovers.length === 0 && depletion.slowMovers.length === 0) ? (
          <Text style={styles.empty}>Not enough sales history yet</Text>
        ) : (
          <>
            {depletion.fastMovers.length > 0 && (
              <>
                <Text style={styles.velocitySubLabel}>Fast Movers</Text>
                {depletion.fastMovers.slice(0, 5).map((p, i) => (
                  <View key={p.productId} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
                    <View style={styles.listRowInfo}>
                      <Text style={styles.listRowTitle} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.listRowSubtitle}>{p.avgDailyVelocity.toFixed(1)}/day</Text>
                    </View>
                    <Text style={styles.listRowValue}>
                      {p.daysUntilStockout != null ? `${Math.round(p.daysUntilStockout)}d left` : '—'}
                    </Text>
                  </View>
                ))}
              </>
            )}
            {depletion.slowMovers.length > 0 && (
              <>
                <Text style={[styles.velocitySubLabel, depletion.fastMovers.length > 0 && styles.velocitySubLabelSpaced]}>Slow Movers</Text>
                {depletion.slowMovers.slice(0, 5).map((p, i) => (
                  <View key={p.productId} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
                    <View style={styles.listRowInfo}>
                      <Text style={styles.listRowTitle} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.listRowSubtitle}>{p.avgDailyVelocity.toFixed(2)}/day</Text>
                    </View>
                    <Text style={styles.listRowValue}>{p.quantity} in stock</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginBottom: Spacing.md },

  periodToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.sm },
  periodBtnActive: { backgroundColor: Colors.primary },
  periodBtnText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary },
  periodBtnTextActive: { color: Colors.white },

  summaryCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  summaryLabel: { fontSize: Typography.size.small, color: Colors.textSecondary },
  summaryValue: { fontSize: Typography.size.display, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginTop: 2, marginBottom: Spacing.md },
  summaryRow: { flexDirection: 'row', marginBottom: Spacing.md },
  summaryStat: { flex: 1 },
  statValue: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  statLabel: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
  paymentSplit: { flexDirection: 'row', gap: Spacing.lg, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider },
  paymentItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: 8, height: 8, borderRadius: BorderRadius.xs },
  paymentText: { fontSize: Typography.size.small, color: Colors.textSecondary },

  sectionTitle: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.xs },

  chartCard: { padding: Spacing.md, marginBottom: Spacing.md },
  chartScroll: { paddingHorizontal: Spacing.xs, alignItems: 'flex-end' },
  barColumn: { alignItems: 'center', width: 56 },
  barValue: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginBottom: 4, height: 14 },
  barTrack: { height: MAX_BAR_HEIGHT, justifyContent: 'flex-end' },
  bar: { width: 22, backgroundColor: Colors.primary, borderRadius: BorderRadius.sm },
  barLabel: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: Spacing.xs, width: 56, textAlign: 'center' },

  listCard: { padding: Spacing.md, marginBottom: Spacing.md },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  listRowBorder: { borderTopWidth: 1, borderTopColor: Colors.divider },
  listRowInfo: { flex: 1, marginRight: Spacing.sm },
  listRowTitle: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  listRowSubtitle: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
  listRowValue: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.success },
  empty: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.sm },

  ratingHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingBottom: Spacing.sm },
  ratingAvg: { fontSize: Typography.size.display, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  starRow: { flexDirection: 'row', gap: 2 },
  ratingCount: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 4 },
  staffRatings: { borderTopWidth: 1, borderTopColor: Colors.divider, marginTop: Spacing.sm, paddingTop: Spacing.xs },

  velocitySubLabel: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  velocitySubLabelSpaced: { marginTop: Spacing.sm },
});
