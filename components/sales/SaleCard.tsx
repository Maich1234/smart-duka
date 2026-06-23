import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ListRow } from '../ui/ListRow';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
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
  isLast?: boolean;
}

export const SaleCard: React.FC<SaleCardProps> = ({ sale, showStaff = false, onPress, isLast = false }) => {
  return (
    <ListRow
      title={sale.invoiceNumber}
      subtitle={`${formatDate(sale.createdAt)}${showStaff && sale.staff ? ` · ${sale.staff.name}` : ''}`}
      isLast={isLast}
      onPress={onPress}
      trailing={
        <View style={styles.right}>
          <Text style={styles.amount}>{formatCurrency(sale.totalAmount)}</Text>
          <Text style={styles.method}>{sale.paymentMethod.toUpperCase()}</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  right: { alignItems: 'flex-end' },
  amount: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  method: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
});
