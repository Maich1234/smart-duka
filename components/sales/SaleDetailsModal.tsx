import React from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

interface SaleDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  sale: any;
}

export const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({ visible, onClose, sale }) => {
  if (!sale) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Sale Details</Text>
        <Text style={styles.invoice}>{sale.invoiceNumber}</Text>
        <Text style={styles.date}>{formatDateTime(sale.createdAt)}</Text>
        <Text style={styles.staff}>Staff: {sale.staff?.name}</Text>
        <Text style={styles.payment}>Payment: {sale.paymentMethod.toUpperCase()}</Text>

        <Text style={styles.itemsTitle}>Items</Text>
        <FlatList
          data={sale.items}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.itemQty}>x{item.quantity}</Text>
              <Text style={styles.itemPrice}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={styles.itemSubtotal}>{formatCurrency(item.subtotal)}</Text>
            </View>
          )}
          scrollEnabled={false}
        />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatCurrency(sale.totalAmount)}</Text>
        </View>

        <Button title="Close" onPress={onClose} style={styles.closeButton} />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.md, color: Colors.textPrimary, textAlign: 'center' },
  invoice: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, textAlign: 'center', color: Colors.primary },
  date: { fontSize: Typography.size.small, textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.xs },
  staff: { fontSize: Typography.size.small, textAlign: 'center', color: Colors.textSecondary },
  payment: { fontSize: Typography.size.small, textAlign: 'center', color: Colors.success, marginBottom: Spacing.md },
  itemsTitle: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, marginTop: Spacing.md, marginBottom: Spacing.sm, color: Colors.textPrimary },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemName: { flex: 2, fontSize: Typography.size.small },
  itemQty: { width: 50, textAlign: 'center', fontSize: Typography.size.small },
  itemPrice: { width: 70, textAlign: 'right', fontSize: Typography.size.small },
  itemSubtotal: { width: 80, textAlign: 'right', fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  totalLabel: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  totalAmount: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilyBold, color: Colors.success },
  closeButton: { marginTop: Spacing.lg },
});