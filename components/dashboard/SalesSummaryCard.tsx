import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';

interface SalesSummaryCardProps {
  total: number;
  cash: number;
  mpesa: number;
  transactions: number;
}

const useCountUp = (target: number, duration = 1500) => {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
};

export const SalesSummaryCard: React.FC<SalesSummaryCardProps> = ({
  total,
  cash,
  mpesa,
  transactions,
}) => {
  const animatedTotal = useCountUp(total);
  const livePulse = useSharedValue(1);

  useEffect(() => {
    livePulse.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [livePulse]);

  const liveDotStyle = useAnimatedStyle(() => ({
    opacity: livePulse.value,
  }));

  return (
    <Animated.View entering={FadeInDown.duration(520).delay(120)} style={styles.wrapper}>
      <LinearGradient
        colors={['#0A1628', '#0D3B2E', '#0F5E56']}
        start={{ x: 0.0, y: 0.0 }}
        end={{ x: 1.0, y: 1.0 }}
        style={styles.card}
      >
        {/* Decorative circles */}
        <View style={styles.decorCircleLarge} />
        <View style={styles.decorCircleSmall} />

        {/* Header row */}
        <View style={styles.headerRow}>
          <Text style={styles.cardLabel}>TODAY'S PERFORMANCE</Text>
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, liveDotStyle]} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Main amount with count-up */}
        <Text style={styles.totalAmount}>{formatCurrency(animatedTotal)}</Text>

        <View style={styles.trendRow}>
          <Ionicons name="trending-up" size={14} color="#4ADE80" />
          <Text style={styles.trendText}>All transactions recorded today</Text>
        </View>

        {/* Glass-style divider */}
        <View style={styles.glassDivider} />

        {/* Metric cells */}
        <View style={styles.metricsRow}>
          <MetricCell icon="cash-outline" label="Cash" value={formatCurrency(cash)} />
          <View style={styles.metricSep} />
          <MetricCell icon="phone-portrait-outline" label="M-Pesa" value={formatCurrency(mpesa)} />
          <View style={styles.metricSep} />
          <MetricCell icon="receipt-outline" label="Sales" value={String(transactions)} isCount />
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const MetricCell = ({
  icon,
  label,
  value,
  isCount = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isCount?: boolean;
}) => (
  <View style={styles.metricCell}>
    <View style={styles.metricIconWrap}>
      <Ionicons name={icon} size={14} color="rgba(255,255,255,0.6)" />
    </View>
    <Text style={[styles.metricValue, isCount && styles.metricValueCount]}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: 24,
    shadowColor: '#0A1628',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  card: {
    borderRadius: 24,
    padding: Spacing.lg,
    paddingTop: 20,
    overflow: 'hidden',
  },
  decorCircleLarge: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.03)',
    top: -60,
    right: -60,
  },
  decorCircleSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -30,
    left: -30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: Typography.size.caption,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    fontFamily: Typography.fontFamilySemiBold,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  liveText: {
    fontSize: 10,
    color: '#4ADE80',
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.8,
  },
  totalAmount: {
    fontSize: 38,
    fontFamily: Typography.fontFamilyBold,
    color: '#D4A043',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 16,
  },
  trendText: {
    fontSize: Typography.size.caption,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Typography.fontFamily,
  },
  glassDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  metricIconWrap: {
    marginBottom: 2,
  },
  metricValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  metricValueCount: {
    fontSize: Typography.size.h3,
    color: '#FFFFFF',
  },
  metricLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Typography.fontFamily,
    letterSpacing: 0.3,
  },
  metricSep: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
