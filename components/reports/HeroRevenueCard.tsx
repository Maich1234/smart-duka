import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  LinearGradient as SvgGrad,
  Stop,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { ReportSummary, ReportBucket, ReportPeriod } from '@/services/reports';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';
import { formatCurrency } from '@/utils/formatters';

// ─── count-up animation ───────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1000): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }
    let rafId: number;
    let startTime: number | null = null;
    const tick = (ts: number) => {
      if (startTime === null) startTime = ts;
      const t = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCurrent(Math.round(target * eased));
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return current;
}

// ─── embedded mini chart ──────────────────────────────────────────────────────

const CHART_H = 104;
const CHART_TOP = 16;
const LABEL_H = 22;

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function MiniChart({ series }: { series: ReportBucket[] }) {
  const [chartW, setChartW] = useState(0);
  const hasData = series.some((b) => b.total > 0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartW(w);
  };

  if (!hasData) {
    return (
      <View style={chart.empty} onLayout={onLayout}>
        <Text style={chart.emptyText}>No sales data in this period</Text>
      </View>
    );
  }

  const maxVal = Math.max(...series.map((b) => b.total), 1);
  const peakIdx = series.reduce(
    (best, b, i) => (b.total > series[best].total ? i : best),
    0,
  );
  const n = series.length;

  // spread points across full chart width
  const xStep = n > 1 ? chartW / (n - 1) : chartW / 2;
  const pts = series.map((b, i) => ({
    x: n > 1 && i === n - 1 ? chartW : i * xStep,
    y: CHART_TOP + (1 - b.total / maxVal) * CHART_H,
  }));

  const line = smoothPath(pts);
  const baseline = CHART_TOP + CHART_H;
  const area = pts.length > 0
    ? `${line} L ${pts[pts.length - 1].x} ${baseline} L ${pts[0].x} ${baseline} Z`
    : '';

  // show labels for first, middle, peak, last (deduplicated)
  const showSet = new Set(
    [0, Math.floor(n / 2), peakIdx, n - 1].filter((i) => i >= 0 && i < n),
  );

  return (
    <View onLayout={onLayout}>
      {chartW > 0 && (
        <>
          <Svg width={chartW} height={CHART_TOP + CHART_H}>
            <Defs>
              <SvgGrad id="mcFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={Colors.primary} stopOpacity={0.22} />
                <Stop offset="1" stopColor={Colors.primary} stopOpacity={0} />
              </SvgGrad>
            </Defs>

            {/* mid-line grid */}
            <Line
              x1={0} y1={CHART_TOP + CHART_H * 0.5}
              x2={chartW} y2={CHART_TOP + CHART_H * 0.5}
              stroke={Colors.border} strokeWidth={1} strokeDasharray="4 4"
            />

            <Path d={area} fill="url(#mcFill)" />
            <Path
              d={line}
              stroke={Colors.primary}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {pts.map((p, i) =>
              i === peakIdx ? (
                <Circle key={i} cx={p.x} cy={p.y} r={5} fill={Colors.accent} stroke="white" strokeWidth={2} />
              ) : (
                <Circle key={i} cx={p.x} cy={p.y} r={2} fill={Colors.primary} opacity={0.5} />
              ),
            )}
          </Svg>

          {/* label row */}
          <View style={{ height: LABEL_H, position: 'relative' }}>
            {series.map((b, i) =>
              showSet.has(i) ? (
                <Text
                  key={b.date}
                  numberOfLines={1}
                  style={[
                    chart.label,
                    { position: 'absolute', left: pts[i].x - 22, width: 44 },
                    i === peakIdx && chart.labelPeak,
                  ]}
                >
                  {b.label}
                </Text>
              ) : null,
            )}
          </View>
        </>
      )}
      {chartW === 0 && (
        <View style={{ height: CHART_TOP + CHART_H + LABEL_H }} onLayout={onLayout} />
      )}
    </View>
  );
}

const chart = StyleSheet.create({
  label: {
    fontSize: 10,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    textAlign: 'center',
    top: 4,
  },
  labelPeak: {
    color: Colors.accentDark,
    fontFamily: Typography.fontFamilySemiBold,
  },
  empty: {
    height: CHART_TOP + CHART_H + LABEL_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
});

// ─── trend computation ────────────────────────────────────────────────────────

function computeTrend(series: ReportBucket[]): number | null {
  if (series.length < 4) return null;
  const mid = Math.floor(series.length / 2);
  const first = series.slice(0, mid).reduce((s, b) => s + b.total, 0);
  const second = series.slice(mid).reduce((s, b) => s + b.total, 0);
  if (first === 0) return null;
  return ((second - first) / first) * 100;
}

const PERIOD_LABEL: Record<ReportPeriod, string> = {
  daily: "Today's Performance",
  weekly: 'This Week',
  monthly: 'This Month',
};

// ─── HeroRevenueCard ──────────────────────────────────────────────────────────

interface Props {
  summary: ReportSummary;
  series: ReportBucket[];
  currency?: string;
  period: ReportPeriod;
}

export const HeroRevenueCard: React.FC<Props> = ({ summary, series, currency, period }) => {
  const animRevenue = useCountUp(summary.totalRevenue);
  const trend = computeTrend(series);
  const profitMargin =
    summary.totalRevenue > 0
      ? (summary.netProfit / summary.totalRevenue) * 100
      : 0;

  const totalPay = summary.cashTotal + summary.mpesaTotal;
  const cashPct = totalPay > 0 ? (summary.cashTotal / totalPay) * 100 : 50;
  const mpesaPct = 100 - cashPct;

  const isProfitPos = summary.netProfit >= 0;
  const isTrendUp = trend !== null && trend >= 0;

  return (
    <Animated.View entering={FadeInDown.duration(420).delay(80)} style={[styles.card, Shadows.lg]}>
      <LinearGradient
        colors={['#E8F5F3', '#F2FAF9', '#FAFFFE']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1.2, y: 1 }}
        style={styles.gradient}
      >
        {/* ── header row ──────────────────────────────────────────────── */}
        <View style={styles.topRow}>
          <View>
            <Text style={styles.periodLabel}>{PERIOD_LABEL[period]}</Text>
            <Text style={styles.revenueLabel}>Total Revenue</Text>
          </View>
          {trend !== null && (
            <View style={[styles.trendBadge, isTrendUp ? styles.trendPos : styles.trendNeg]}>
              <Ionicons
                name={isTrendUp ? 'trending-up' : 'trending-down'}
                size={13}
                color={isTrendUp ? Colors.success : Colors.danger}
              />
              <Text style={[styles.trendText, isTrendUp ? styles.trendPosText : styles.trendNegText]}>
                {Math.abs(trend).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>

        {/* ── main value ──────────────────────────────────────────────── */}
        <Text style={styles.revenueValue} adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1}>
          {formatCurrency(animRevenue, currency)}
        </Text>

        {/* ── margin pill ─────────────────────────────────────────────── */}
        <View style={styles.marginRow}>
          <View style={[styles.marginBadge, isProfitPos ? styles.marginPos : styles.marginNeg]}>
            <Ionicons
              name={isProfitPos ? 'arrow-up' : 'arrow-down'}
              size={10}
              color={isProfitPos ? Colors.success : Colors.danger}
            />
            <Text style={[styles.marginText, isProfitPos ? styles.marginPosText : styles.marginNegText]}>
              {Math.abs(profitMargin).toFixed(1)}% margin
            </Text>
          </View>
        </View>

        {/* ── sub-metrics ─────────────────────────────────────────────── */}
        <View style={styles.metricGrid}>
          <View style={styles.metricCell}>
            <View style={[styles.metricIcon, { backgroundColor: '#E6F4F2' }]}>
              <Ionicons name="receipt-outline" size={13} color={Colors.primary} />
            </View>
            <Text style={styles.metricValue}>{summary.totalTransactions}</Text>
            <Text style={styles.metricLabel}>Sales</Text>
          </View>

          <View style={[styles.metricCell, styles.metricBorder]}>
            <View style={[styles.metricIcon, { backgroundColor: Colors.accentSubtle }]}>
              <Ionicons name="stats-chart-outline" size={13} color={Colors.accent} />
            </View>
            <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatCurrency(summary.averageSale, currency)}
            </Text>
            <Text style={styles.metricLabel}>Avg. Sale</Text>
          </View>

          <View style={styles.metricCell}>
            <View
              style={[
                styles.metricIcon,
                { backgroundColor: isProfitPos ? Colors.successSubtle : Colors.dangerSubtle },
              ]}
            >
              <Ionicons
                name={isProfitPos ? 'trending-up-outline' : 'trending-down-outline'}
                size={13}
                color={isProfitPos ? Colors.success : Colors.danger}
              />
            </View>
            <Text
              style={[styles.metricValue, isProfitPos ? styles.profitPos : styles.profitNeg]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatCurrency(summary.netProfit, currency)}
            </Text>
            <Text style={styles.metricLabel}>Net Profit</Text>
          </View>
        </View>

        {/* ── divider ─────────────────────────────────────────────────── */}
        <View style={styles.divider} />

        {/* ── payment sources ─────────────────────────────────────────── */}
        <Text style={styles.sectionMini}>Revenue Sources</Text>

        <View style={styles.payRow}>
          <View style={[styles.payDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.payName}>Cash</Text>
          <View style={styles.payTrack}>
            <View
              style={[
                styles.payFill,
                { width: `${Math.max(cashPct, 2)}%`, backgroundColor: Colors.success },
              ]}
            />
          </View>
          <Text style={styles.payAmt} numberOfLines={1}>
            {formatCurrency(summary.cashTotal, currency)}
          </Text>
        </View>

        <View style={[styles.payRow, { marginTop: Spacing.sm }]}>
          <View style={[styles.payDot, { backgroundColor: Colors.info }]} />
          <Text style={styles.payName}>M-Pesa</Text>
          <View style={styles.payTrack}>
            <View
              style={[
                styles.payFill,
                { width: `${Math.max(mpesaPct, 2)}%`, backgroundColor: Colors.info },
              ]}
            />
          </View>
          <Text style={styles.payAmt} numberOfLines={1}>
            {formatCurrency(summary.mpesaTotal, currency)}
          </Text>
        </View>

        {/* ── chart ───────────────────────────────────────────────────── */}
        <View style={styles.divider} />
        <Text style={[styles.sectionMini, { marginBottom: Spacing.sm }]}>Sales Trend</Text>
        <MiniChart series={series} />
      </LinearGradient>
    </Animated.View>
  );
};

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#C5E8E4',
  },
  gradient: {
    padding: Spacing.lg,
  },

  // header
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  periodLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  revenueLabel: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  trendPos: {
    backgroundColor: Colors.successSubtle,
    borderColor: '#A7D7B8',
  },
  trendNeg: {
    backgroundColor: Colors.dangerSubtle,
    borderColor: '#F9B4B4',
  },
  trendText: {
    fontSize: 12,
    fontFamily: Typography.fontFamilySemiBold,
  },
  trendPosText: { color: Colors.success },
  trendNegText: { color: Colors.danger },

  // revenue value
  revenueValue: {
    fontSize: 44,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -1,
    marginTop: Spacing.xs,
    lineHeight: 52,
  },

  // margin badge
  marginRow: {
    flexDirection: 'row',
    marginTop: 6,
    marginBottom: Spacing.md,
  },
  marginBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  marginPos: { backgroundColor: Colors.successSubtle },
  marginNeg: { backgroundColor: Colors.dangerSubtle },
  marginText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
  },
  marginPosText: { color: Colors.success },
  marginNegText: { color: Colors.danger },

  // sub metrics
  metricGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(197,232,228,0.7)',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 3,
  },
  metricBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(197,232,228,0.7)',
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    letterSpacing: 0.1,
  },
  profitPos: { color: Colors.success },
  profitNeg: { color: Colors.danger },

  // divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(197,232,228,0.6)',
    marginVertical: Spacing.md,
  },

  // payment
  sectionMini: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  payName: {
    fontSize: 12,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    width: 44,
  },
  payTrack: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(197,232,228,0.5)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  payFill: {
    height: '100%',
    borderRadius: 3,
  },
  payAmt: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    width: 88,
    textAlign: 'right',
  },
});
