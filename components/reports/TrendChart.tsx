import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import type { ReportBucket } from '@/services/reports';

interface TrendChartProps {
  series: ReportBucket[];
}

const MAX_BAR_HEIGHT = 120;
const MIN_BAR_HEIGHT = 3;

/** Compact value for the tight bar-chart column (e.g. "12.4K") — the full
 * currency-formatted amount is already shown in the summary card above. */
const compactNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return Math.round(value).toString();
};

/**
 * Bar chart for the sales trend. The single highest bucket in the visible
 * range is emphasized (gradient fill + value callout) so the eye lands on
 * the period's best day/week/month, similar to how Stripe/Square dashboards
 * draw attention to a standout data point instead of weighting every bar
 * equally.
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

  return (
    <View>
      <View style={styles.baseline} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {series.map((bucket, i) => {
          const isPeak = i === peakIndex && bucket.total > 0;
          const height = Math.max((bucket.total / maxTotal) * MAX_BAR_HEIGHT, bucket.total > 0 ? MIN_BAR_HEIGHT : 0);

          return (
            <View key={bucket.date} style={styles.column}>
              <Text style={[styles.value, isPeak && styles.valuePeak]} numberOfLines={1}>
                {bucket.total > 0 ? compactNumber(bucket.total) : ''}
              </Text>
              <View style={styles.track}>
                {isPeak ? (
                  <LinearGradient
                    colors={[Colors.primaryLight, Colors.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[styles.bar, { height }]}
                  />
                ) : (
                  <View style={[styles.bar, styles.barMuted, { height }]} />
                )}
              </View>
              <Text style={[styles.label, isPeak && styles.labelPeak]} numberOfLines={1}>
                {bucket.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing.xs, alignItems: 'flex-end' },
  column: { alignItems: 'center', width: 60 },
  value: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
    height: 14,
  },
  valuePeak: { color: Colors.primaryDark },
  track: { height: MAX_BAR_HEIGHT, justifyContent: 'flex-end' },
  bar: {
    width: 24,
    borderTopLeftRadius: BorderRadius.sm,
    borderTopRightRadius: BorderRadius.sm,
  },
  barMuted: { backgroundColor: Colors.primarySubtle },
  baseline: {
    position: 'absolute',
    left: Spacing.xs,
    right: Spacing.xs,
    bottom: 33,
    height: 1,
    backgroundColor: Colors.divider,
  },
  label: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    width: 60,
    textAlign: 'center',
  },
  labelPeak: {
    color: Colors.primaryDark,
    fontFamily: Typography.fontFamilySemiBold,
  },
  emptyState: { paddingVertical: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: Typography.size.small, color: Colors.textSecondary },
});
