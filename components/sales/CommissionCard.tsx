import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';
import { ListRow } from '../ui/ListRow';
import { formatCurrency } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import type { CommissionSummary } from '@/services/sales';

export type CommissionPeriod = 'today' | 'week' | 'month';

/** Computes a [startDate, endDate] ISO pair for a period, matching the
 * startDate/endDate query-param convention the commission endpoints use. */
export const getCommissionPeriodRange = (period: CommissionPeriod): { startDate: string; endDate: string } => {
  const now = new Date();
  let start: Date;
  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'week') {
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { startDate: start.toISOString(), endDate: now.toISOString() };
};

const PERIOD_OPTIONS: { value: CommissionPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

interface CommissionCardProps {
  data?: CommissionSummary;
  isLoading: boolean;
  /** Set when the shop owner hasn't enabled commission visibility for staff. */
  forbidden?: boolean;
  period: CommissionPeriod;
  onPeriodChange: (period: CommissionPeriod) => void;
  currency?: string;
}

export const CommissionCard: React.FC<CommissionCardProps> = ({
  data,
  isLoading,
  forbidden = false,
  period,
  onPeriodChange,
  currency = 'KES',
}) => {
  if (forbidden) {
    return (
      <EmptyState
        title="Commission hidden"
        subtitle="Your shop owner hasn't turned on commission visibility yet."
      />
    );
  }

  return (
    <View>
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((opt) => {
          const active = period === opt.value;
          return (
            <AnimatedPressable
              key={opt.value}
              style={[styles.periodChip, active && styles.periodChipActive]}
              onPress={() => onPeriodChange(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>{opt.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {isLoading ? (
        <LoadingState fullscreen={false} />
      ) : (
        <>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total commission</Text>
            <Text style={styles.totalValue}>{formatCurrency(data?.totalCommission ?? 0, currency)}</Text>
            <Text style={styles.totalSub}>
              {data?.salesCount ?? 0} sale{(data?.salesCount ?? 0) === 1 ? '' : 's'}
            </Text>
          </View>

          {data && data.byProduct.length > 0 ? (
            data.byProduct.map((p, i) => (
              <ListRow
                key={`${p.productId}:${p.variantId ?? ''}`}
                title={p.variantName ? `${p.productName} (${p.variantName})` : p.productName}
                subtitle={`${p.unitsSold} sold`}
                trailing={<Text style={styles.rowAmount}>{formatCurrency(p.commission, currency)}</Text>}
                isLast={i === data.byProduct.length - 1}
              />
            ))
          ) : (
            <EmptyState title="No commission yet" subtitle="Sell a commission-enabled variant to start earning." />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  periodRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  periodChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  periodChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  periodChipText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  periodChipTextActive: { color: Colors.primary },
  totalBox: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
  },
  totalLabel: { fontSize: Typography.size.caption, color: Colors.textSecondary },
  totalValue: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
    marginTop: 2,
  },
  totalSub: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
  rowAmount: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.success,
  },
});
