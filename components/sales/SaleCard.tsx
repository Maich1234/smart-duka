import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface SaleCardProps {
  sale: {
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
    staff?: { name: string };
  };
  showStaff?: boolean;
  onPress?: () => void;
}

export const SaleCard: React.FC<SaleCardProps> = ({ sale, showStaff = false, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.invoice}>{sale.invoiceNumber}</Text>
          <Text style={styles.amount}>{formatCurrency(sale.totalAmount)}</Text>
        </View>
        <Text style={styles.date}>{formatDate(sale.createdAt)}</Text>
        {showStaff && sale.staff && (
          <Text style={styles.staff}>By: {sale.staff.name}</Text>
        )}
        <View style={styles.methodContainer}>
          <Text style={[styles.method, { color: sale.paymentMethod === 'cash' ? Colors.success : Colors.primary }]}>
            {sale.paymentMethod.toUpperCase()}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.md, marginVertical: Spacing.xs, padding: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  invoice: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  amount: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.success },
  date: { fontSize: Typography.size.small, color: Colors.textSecondary, marginBottom: 2 },
  staff: { fontSize: Typography.size.small, color: Colors.textSecondary, marginBottom: 2 },
  methodContainer: { alignItems: 'flex-start' },
  method: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, backgroundColor: Colors.border, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, overflow: 'hidden' },
});