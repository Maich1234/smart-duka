import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';
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
    <LinearGradient
      colors={[Colors.primary, Colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.title}>Today’s Sales</Text>
      <Text style={styles.total}>{formatCurrency(total)}</Text>
      <View style={styles.divider} />
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
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
  },
  title: { fontSize: Typography.size.small, color: 'rgba(255,255,255,0.8)', marginBottom: Spacing.xs },
  total: { fontSize: Typography.size.display, fontFamily: Typography.fontFamilyBold, color: Colors.white, marginBottom: Spacing.md },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: Spacing.md },
  row: { flexDirection: 'row', marginBottom: Spacing.md },
  item: { flex: 1 },
  label: { fontSize: Typography.size.small, color: 'rgba(255,255,255,0.75)' },
  value: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.white },
  transactions: { fontSize: Typography.size.small, color: 'rgba(255,255,255,0.75)' },
});