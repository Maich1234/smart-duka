import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';

interface SalesSummaryCardProps {
  total: number;
  cash: number;
  mpesa: number;
  transactions: number;
}

/** Flat hero stat — the total carries weight through type size alone, no
 * gradient or shadow competing for attention. */
export const SalesSummaryCard: React.FC<SalesSummaryCardProps> = ({
  total,
  cash,
  mpesa,
  transactions,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Today&rsquo;s Sales</Text>
      <Text style={styles.total}>{formatCurrency(total)}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaItem}>Cash {formatCurrency(cash)}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaItem}>M-Pesa {formatCurrency(mpesa)}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaItem}>{transactions} transaction{transactions === 1 ? '' : 's'}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  label: { fontSize: Typography.size.small, color: Colors.textSecondary },
  total: { fontSize: Typography.size.display, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: Spacing.xs },
  metaItem: { fontSize: Typography.size.small, color: Colors.textSecondary },
  metaDot: { fontSize: Typography.size.small, color: Colors.textTertiary, marginHorizontal: Spacing.xs },
});
