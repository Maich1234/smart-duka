import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MetricCard } from './MetricCard';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';

interface StatsRowProps {
  products: number;
  stockValue: number;
  lowStockCount: number;
}

export const StatsRow: React.FC<StatsRowProps> = ({ products, stockValue, lowStockCount }) => (
  <View style={styles.container}>
    <MetricCard title="Products" value={products} />
    <MetricCard title="Stock Value" value={formatCurrency(stockValue)} />
    <MetricCard title="Low Stock" value={lowStockCount} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    gap: Spacing.sm,
  },
});
