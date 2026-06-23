import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';

interface StatsRowProps {
  products: number;
  stockValue: number;
  lowStockCount: number;
}

/** Flat metrics row — one surface, hairline dividers between cells, no
 * per-stat shadowed boxes. */
export const StatsRow: React.FC<StatsRowProps> = ({ products, stockValue, lowStockCount }) => (
  <View style={styles.row}>
    <View style={styles.cell}>
      <Text style={styles.value}>{products}</Text>
      <Text style={styles.label}>Products</Text>
    </View>
    <View style={[styles.cell, styles.cellDivider]}>
      <Text style={[styles.value, styles.valueAccent]}>{formatCurrency(stockValue)}</Text>
      <Text style={styles.label}>Stock Value</Text>
    </View>
    <View style={styles.cell}>
      <Text style={[styles.value, lowStockCount > 0 && styles.valueWarning]}>{lowStockCount}</Text>
      <Text style={styles.label}>Low Stock</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.divider,
  },
  cell: { flex: 1, alignItems: 'center' },
  cellDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.divider },
  value: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  valueAccent: { color: Colors.accentDark },
  valueWarning: { color: Colors.danger },
  label: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
});
