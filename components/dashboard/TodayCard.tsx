import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';

interface TodayCardProps {
  total: number;
  cash: number;
  mpesa: number;
  transactions: number;
  /** Gross profit estimate; hidden when the backend doesn't provide it. */
  profit?: number;
  /** Yesterday's total; enables the vs-yesterday trend chip. */
  yesterdayTotal?: number;
}

/** Count-up kept short — the number must be readable within a second. */
const useCountUp = (target: number, duration = 700) => {
  const [value, setValue] = useState(target);
  const rafRef = useRef<number | null>(null);
  const mountedTarget = useRef(target);

  useEffect(() => {
    if (target === mountedTarget.current && value === target) return;
    mountedTarget.current = target;
    const from = value;
    const startTime = Date.now();
    const tick = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
};

const TrendChip: React.FC<{ total: number; yesterdayTotal?: number }> = ({ total, yesterdayTotal }) => {
  if (yesterdayTotal == null || yesterdayTotal <= 0 || total <= 0) return null;
  const pct = Math.round(((total - yesterdayTotal) / yesterdayTotal) * 100);
  const up = pct >= 0;
  return (
    <View style={[styles.trendChip, { backgroundColor: up ? 'rgba(74,222,128,0.16)' : 'rgba(248,113,113,0.16)' }]}>
      <Ionicons name={up ? 'trending-up' : 'trending-down'} size={12} color={up ? '#4ADE80' : '#F87171'} />
      <Text style={[styles.trendChipText, { color: up ? '#4ADE80' : '#F87171' }]}>
        {up ? '+' : ''}
        {pct}% vs yesterday
      </Text>
    </View>
  );
};

/**
 * Today's Performance hero. One headline number, one comparison, two
 * supporting stats, and a payment-split bar — nothing that needs studying.
 * Dark brand gradient and gold total are kept from the existing identity;
 * the decorative motion and fake "LIVE" badge are not.
 */
export const TodayCard: React.FC<TodayCardProps> = React.memo(
  ({ total, cash, mpesa, transactions, profit, yesterdayTotal }) => {
    const animatedTotal = useCountUp(total);

    const other = Math.max(total - cash - mpesa, 0);
    const splitBase = cash + mpesa + other;
    const pctOf = (part: number) => (splitBase > 0 ? Math.max((part / splitBase) * 100, part > 0 ? 3 : 0) : 0);

    return (
      <View style={styles.wrapper}>
        <LinearGradient
          colors={['#0A1628', '#0D3B2E', '#0F5E56']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.decorCircle} pointerEvents="none" />

          <View style={styles.headerRow}>
            <Text style={styles.cardLabel}>{"TODAY'S SALES"}</Text>
            <TrendChip total={total} yesterdayTotal={yesterdayTotal} />
          </View>

          <Text
            style={styles.totalAmount}
            accessibilityLabel={`Today's sales total ${formatCurrency(total)}`}
          >
            {formatCurrency(animatedTotal)}
          </Text>

          <View style={styles.statsRow}>
            {profit != null && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Profit</Text>
                <Text style={styles.statValue}>{formatCurrency(profit)}</Text>
              </View>
            )}
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Sales</Text>
              <Text style={styles.statValue}>{transactions}</Text>
            </View>
          </View>

          {splitBase > 0 && (
            <>
              <View style={styles.splitBar} accessible accessibilityLabel={`Payment split: cash ${formatCurrency(cash)}, M-Pesa ${formatCurrency(mpesa)}`}>
                {cash > 0 && <View style={[styles.splitSegment, { flexBasis: `${pctOf(cash)}%`, backgroundColor: '#4ADE80' }]} />}
                {mpesa > 0 && <View style={[styles.splitSegment, { flexBasis: `${pctOf(mpesa)}%`, backgroundColor: '#60A5FA' }]} />}
                {other > 0 && <View style={[styles.splitSegment, { flexBasis: `${pctOf(other)}%`, backgroundColor: 'rgba(255,255,255,0.35)' }]} />}
              </View>
              <View style={styles.legendRow}>
                <LegendItem color="#4ADE80" label="Cash" value={formatCurrency(cash)} />
                <LegendItem color="#60A5FA" label="M-Pesa" value={formatCurrency(mpesa)} />
                {other > 0 && <LegendItem color="rgba(255,255,255,0.55)" label="Other" value={formatCurrency(other)} />}
              </View>
            </>
          )}
        </LinearGradient>
      </View>
    );
  },
);

TodayCard.displayName = 'TodayCard';

const LegendItem: React.FC<{ color: string; label: string; value: string }> = ({ color, label, value }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendLabel}>{label}</Text>
    <Text style={styles.legendValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: 20,
    shadowColor: '#0A1628',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  card: {
    borderRadius: 20,
    padding: Spacing.md,
    paddingVertical: 20,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: -70,
    right: -50,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: Typography.size.caption,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.2,
    fontFamily: Typography.fontFamilySemiBold,
  },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendChipText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
  },
  totalAmount: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: Typography.fontFamilyBold,
    color: '#E8B54A',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: 16,
  },
  stat: {
    gap: 2,
  },
  statLabel: {
    fontSize: Typography.size.caption,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: Typography.fontFamily,
  },
  statValue: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  splitBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 10,
    gap: 2,
  },
  splitSegment: {
    height: '100%',
    borderRadius: 3,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.md,
    rowGap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontSize: Typography.size.caption,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: Typography.fontFamily,
  },
  legendValue: {
    fontSize: Typography.size.caption,
    color: '#FFFFFF',
    fontFamily: Typography.fontFamilySemiBold,
    fontVariant: ['tabular-nums'],
  },
});
