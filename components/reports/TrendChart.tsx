import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import type { ReportBucket } from '@/services/reports';

interface TrendChartProps {
  series: ReportBucket[];
}

const COLUMN_WIDTH = 56;
const CHART_HEIGHT = 120;
const TOP_PADDING = 32;

/** Compact value for the tight chart column (e.g. "12.4K") — the full
 * currency-formatted amount is already shown in the summary card above. */
const compactNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return Math.round(value).toString();
};

interface Point {
  x: number;
  y: number;
}

/** Quadratic-through-midpoints smoothing — gives a gently curved line through
 * every data point without the overshoot a full Catmull-Rom spline can produce
 * on spiky sales data. */
const smoothLinePath = (points: Point[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
};

/**
 * Smoothed line + gradient-fill area chart for the sales trend, with the
 * single highest bucket in the visible range called out via a gold dot and
 * value label — similar to how Stripe/Square dashboards draw the eye to a
 * standout data point instead of weighting every point equally.
 */
export const TrendChart: React.FC<TrendChartProps> = ({ series }) => {
  const hasData = series.some((b) => b.total > 0);

  if (!hasData) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No sales in this period</Text>
      </View>
    );
  }

  const maxTotal = Math.max(...series.map((b) => b.total), 1);
  const peakIndex = series.reduce(
    (best, bucket, i) => (bucket.total > series[best].total ? i : best),
    0
  );

  const chartWidth = series.length * COLUMN_WIDTH;
  const baselineY = TOP_PADDING + CHART_HEIGHT;

  const points: Point[] = series.map((bucket, i) => ({
    x: i * COLUMN_WIDTH + COLUMN_WIDTH / 2,
    y: TOP_PADDING + (1 - bucket.total / maxTotal) * CHART_HEIGHT,
  }));

  const linePath = smoothLinePath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
  const peakPoint = points[peakIndex];

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: chartWidth }}>
          <View style={styles.peakLabelLayer}>
            <View style={[styles.peakLabelWrap, { left: peakPoint.x - COLUMN_WIDTH / 2 }]}>
              <Text style={styles.peakLabel} numberOfLines={1}>
                {compactNumber(series[peakIndex].total)}
              </Text>
            </View>
          </View>

          <Svg width={chartWidth} height={TOP_PADDING + CHART_HEIGHT}>
            <Defs>
              <SvgLinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={Colors.primaryLight} stopOpacity={0.35} />
                <Stop offset="1" stopColor={Colors.primaryLight} stopOpacity={0} />
              </SvgLinearGradient>
            </Defs>

            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={0}
                x2={chartWidth}
                y1={TOP_PADDING + CHART_HEIGHT * f}
                y2={TOP_PADDING + CHART_HEIGHT * f}
                stroke={Colors.divider}
                strokeWidth={1}
              />
            ))}

            <Path d={areaPath} fill="url(#areaFill)" />
            <Path d={linePath} stroke={Colors.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" />

            {points.map((p, i) =>
              i === peakIndex ? (
                <Circle key={i} cx={p.x} cy={p.y} r={5} fill={Colors.accent} stroke={Colors.surface} strokeWidth={2} />
              ) : (
                <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={Colors.primary} />
              )
            )}
          </Svg>

          <View style={styles.labelRow}>
            {series.map((bucket, i) => (
              <View key={bucket.date} style={styles.labelCol}>
                <Text style={[styles.label, i === peakIndex && styles.labelPeak]} numberOfLines={1}>
                  {bucket.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  peakLabelLayer: { height: 0 },
  peakLabelWrap: { position: 'absolute', top: 0, width: COLUMN_WIDTH, alignItems: 'center', zIndex: 1 },
  peakLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.accentDark,
  },
  labelRow: { flexDirection: 'row' },
  labelCol: { width: COLUMN_WIDTH, alignItems: 'center' },
  label: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  labelPeak: {
    color: Colors.accentDark,
    fontFamily: Typography.fontFamilySemiBold,
  },
  emptyState: { paddingVertical: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: Typography.size.small, color: Colors.textSecondary },
});
