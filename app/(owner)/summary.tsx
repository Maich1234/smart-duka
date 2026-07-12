import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { QueryError } from '@/components/ui/QueryError';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { getDailySummary } from '@/services/shifts';
import { formatCurrency } from '@/utils/formatters';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const shiftDay = (dateStr: string, delta: number) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDay(d);
};

const dayLabel = (dateStr: string) => {
  const today = isoDay(new Date());
  if (dateStr === today) return 'Today';
  if (dateStr === shiftDay(today, -1)) return 'Yesterday';
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const StatTile: React.FC<{
  label: string;
  value: string;
  tint?: string;
  style?: object;
}> = ({ label, value, tint, style }) => (
  <View style={[styles.statTile, style]}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, tint ? { color: tint } : null]} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
  </View>
);

const Section: React.FC<{ title: string; delay?: number; children: React.ReactNode }> = ({ title, delay = 0, children }) => (
  <Animated.View entering={FadeInUp.duration(380).delay(delay)} style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </Animated.View>
);

export default function DailySummaryScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : isoDay(new Date())
  );
  const today = isoDay(new Date());

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ['dailySummary', date],
    queryFn: () => getDailySummary(date),
  });

  const summary = data?.data;
  const methodBars = useMemo(() => {
    if (!summary) return [];
    const entries = [
      { key: 'Cash', value: summary.byMethod.cash?.total ?? 0, color: Colors.primary },
      { key: 'M-PESA', value: summary.byMethod.mpesa?.total ?? 0, color: Colors.successLight },
      { key: 'Card', value: summary.byMethod.card?.total ?? 0, color: Colors.accentLight },
    ];
    const max = Math.max(1, ...entries.map((e) => e.value));
    return entries.map((e) => ({ ...e, fraction: e.value / max }));
  }, [summary]);

  const changeDay = (delta: number) => {
    haptics.selection();
    setDate((d) => {
      const next = shiftDay(d, delta);
      return next > today ? d : next;
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} colors={[Colors.primary]} />
      }
    >
      {/* Day switcher */}
      <Animated.View entering={FadeInDown.duration(350)} style={styles.dayRow}>
        <AnimatedPressable onPress={() => changeDay(-1)} style={styles.dayBtn} accessibilityRole="button" accessibilityLabel="Previous day">
          <Ionicons name="chevron-back" size={18} color={Colors.textSecondary} />
        </AnimatedPressable>
        <View style={styles.dayCenter}>
          <Text style={styles.dayTitle}>{dayLabel(date)}</Text>
          <Text style={styles.dayDate}>{date}</Text>
        </View>
        <AnimatedPressable
          onPress={() => changeDay(1)}
          disabled={date >= today}
          style={[styles.dayBtn, date >= today && styles.dayBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Next day"
        >
          <Ionicons name="chevron-forward" size={18} color={date >= today ? Colors.textDisabled : Colors.textSecondary} />
        </AnimatedPressable>
      </Animated.View>

      {isLoading ? (
        <ListSkeleton rows={5} heroHeight={140} />
      ) : isError || !summary ? (
        <QueryError onRetry={refetch} />
      ) : (
        <>
          {/* Revenue hero */}
          <Animated.View entering={FadeInUp.duration(400)} style={styles.heroWrap}>
            <LinearGradient colors={['#0F766E', '#0D3B2E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <Text style={styles.heroLabel}>Revenue</Text>
              <Text style={styles.heroValue}>{formatCurrency(summary.totals.revenue)}</Text>
              <Text style={styles.heroSub}>
                {summary.totals.transactions} transactions · est. profit{' '}
                {formatCurrency(summary.totals.grossProfit)}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Key stats */}
          <Section title="AT A GLANCE" delay={60}>
            <View style={styles.statGrid}>
              <StatTile label="Expenses" value={formatCurrency(summary.totals.expenses)} />
              <StatTile label="Discounts" value={formatCurrency(summary.totals.discounts)} />
              <StatTile
                label={`Refunds (${summary.refunds.count})`}
                value={formatCurrency(summary.refunds.total)}
                tint={summary.refunds.count > 0 ? Colors.danger : undefined}
              />
              <StatTile label={`Voids (${summary.voids.count})`} value={formatCurrency(summary.voids.total)} />
            </View>
          </Section>

          {/* Payment breakdown */}
          <Section title="PAYMENTS" delay={120}>
            <View style={styles.card}>
              {methodBars.map((bar) => (
                <View key={bar.key} style={styles.barRow}>
                  <Text style={styles.barLabel}>{bar.key}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.max(2, bar.fraction * 100)}%`, backgroundColor: bar.color }]} />
                  </View>
                  <Text style={styles.barValue}>{formatCurrency(bar.value)}</Text>
                </View>
              ))}
              {Math.abs(summary.mpesaReconciliation.delta) > 1 ? (
                <View style={styles.reconWarn}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
                  <Text style={styles.reconWarnText}>
                    M-PESA sales vs confirmed payments differ by{' '}
                    {formatCurrency(Math.abs(summary.mpesaReconciliation.delta))}
                  </Text>
                </View>
              ) : null}
            </View>
          </Section>

          {/* Insights */}
          {summary.insights.length > 0 ? (
            <Section title="INSIGHTS" delay={180}>
              <View style={styles.card}>
                {summary.insights.map((insight, i) => (
                  <View key={i} style={[styles.insightRow, i > 0 && styles.insightRowBorder]}>
                    <Ionicons name="sparkles" size={13} color={Colors.accent} style={styles.insightIcon} />
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Shifts */}
          <Section title="SHIFTS" delay={240}>
            <View style={styles.card}>
              <View style={styles.shiftStatsRow}>
                <StatTile style={styles.tileThird} label="Closed" value={`${summary.shifts.count}`} />
                <StatTile style={styles.tileThird} label="Still open" value={`${summary.shifts.unclosed}`} tint={summary.shifts.unclosed > 0 ? Colors.warning : undefined} />
                <StatTile
                  style={styles.tileThird}
                  label="Drawer +/−"
                  value={formatCurrency(summary.shifts.totalDiscrepancy)}
                  tint={summary.shifts.totalDiscrepancy < 0 ? Colors.danger : summary.shifts.totalDiscrepancy > 0 ? Colors.info : Colors.success}
                />
              </View>
            </View>
          </Section>

          {/* Best sellers */}
          {summary.bestSellers.length > 0 ? (
            <Section title="BEST SELLERS" delay={300}>
              <View style={styles.card}>
                {summary.bestSellers.map((p, i) => (
                  <View key={String(p.productId)} style={[styles.productRow, i > 0 && styles.insightRowBorder]}>
                    <Text style={styles.productRank}>{i + 1}</Text>
                    <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.productQty}>×{p.quantity}</Text>
                    <Text style={styles.productRevenue}>{formatCurrency(p.revenue)}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Slow movers */}
          {summary.slowMovers.length > 0 ? (
            <Section title="SLOW MOVERS (7 DAYS, NO SALES)" delay={360}>
              <View style={styles.card}>
                {summary.slowMovers.map((p, i) => (
                  <View key={String(p.productId)} style={[styles.productRow, i > 0 && styles.insightRowBorder]}>
                    <Ionicons name="hourglass-outline" size={14} color={Colors.textTertiary} />
                    <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.productQty}>{p.stock} in stock</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Staff performance */}
          {summary.staffPerformance.length > 0 ? (
            <Section title="TEAM" delay={420}>
              <View style={styles.card}>
                {summary.staffPerformance.map((s, i) => (
                  <View key={String(s.staffId)} style={[styles.productRow, i > 0 && styles.insightRowBorder]}>
                    <View style={styles.staffAvatar}>
                      <Ionicons name="person" size={12} color={Colors.primary} />
                    </View>
                    <Text style={styles.productName} numberOfLines={1}>{s.name ?? 'Staff'}</Text>
                    <Text style={styles.productQty}>{s.salesCount} sales</Text>
                    <Text style={styles.productRevenue}>{formatCurrency(s.revenue)}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Inventory footer */}
          <Section title="INVENTORY" delay={480}>
            <View style={styles.card}>
              <View style={styles.shiftStatsRow}>
                <StatTile style={styles.tileThird} label="Low stock" value={`${summary.inventory.lowStockCount}`} tint={summary.inventory.lowStockCount > 0 ? Colors.warning : undefined} />
                <StatTile style={styles.tileThird} label="Adjustments" value={`${summary.inventory.adjustments}`} />
                <StatTile style={styles.tileThird} label="Stock value" value={formatCurrency(summary.inventory.stockValue)} />
              </View>
            </View>
          </Section>

          <Text style={styles.generatedAt}>
            Generated {new Date(summary.generatedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
            {' · '}pull to refresh
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  dayRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  dayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnDisabled: { opacity: 0.4 },
  dayCenter: { flex: 1, alignItems: 'center' },
  dayTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  dayDate: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },
  heroWrap: { borderRadius: BorderRadius.xl, ...Shadows.md, marginBottom: Spacing.md },
  hero: { borderRadius: BorderRadius.xl, padding: Spacing.lg },
  heroLabel: {
    color: 'rgba(248,250,252,0.7)',
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: -0.5,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  heroSub: {
    color: 'rgba(248,250,252,0.75)',
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    marginTop: 6,
  },
  section: { marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statTile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  statLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  statValue: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginTop: 3,
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
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  barLabel: {
    width: 56,
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
  reconWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.warningSubtle,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
  },
  reconWarnText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#92400E',
  },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  insightRowBorder: { borderTopWidth: 1, borderTopColor: Colors.divider },
  insightIcon: { marginTop: 2 },
  insightText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  shiftStatsRow: { flexDirection: 'row', gap: Spacing.sm },
  // Inside a 3-across row the grid basis would overflow — flex from zero instead.
  tileThird: { flexBasis: 0, borderWidth: 0, padding: 0, shadowOpacity: 0, elevation: 0, backgroundColor: 'transparent' },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  productRank: {
    width: 20,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.accent,
  },
  productName: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  productQty: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  productRevenue: {
    minWidth: 70,
    textAlign: 'right',
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  staffAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatedAt: {
    textAlign: 'center',
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
});
