import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
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

export const SalesSummaryCard: React.FC<SalesSummaryCardProps> = ({
  total,
  cash,
  mpesa,
  transactions,
}) => {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Today’s Sales</Text>
      <Text style={styles.total}>{formatCurrency(total)}</Text>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text style={styles.label}>Cash</Text>
          <Text style={styles.value}>{formatCurrency(cash)}</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.label}>M-Pesa</Text>
          <Text style={styles.value}>{formatCurrency(mpesa)}</Text>
        </View>
      </View>
      <Text style={styles.transactions}>Transactions: {transactions}</Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginHorizontal: Spacing.md, marginVertical: Spacing.sm },
  title: { fontSize: Typography.size.small, color: Colors.textSecondary, marginBottom: Spacing.xs },
  total: { fontSize: Typography.size.h1, fontFamily: Typography.fontFamilyBold, color: Colors.success, marginBottom: Spacing.md },
  row: { flexDirection: 'row', marginBottom: Spacing.md },
  item: { flex: 1 },
  label: { fontSize: Typography.size.small, color: Colors.textSecondary },
  value: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  transactions: { fontSize: Typography.size.small, color: Colors.textSecondary },
});