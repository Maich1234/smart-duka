import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';

interface CartSummaryProps {
  total: number;
  totalSavings?: number;
  paymentMethod: 'cash' | 'mpesa';
  onPaymentMethodChange: (method: 'cash' | 'mpesa') => void;
  onCheckout: () => void;
  loading?: boolean;
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  total,
  totalSavings = 0,
  paymentMethod,
  onPaymentMethodChange,
  onCheckout,
  loading = false,
}) => {
  return (
    <View style={styles.container}>
      {totalSavings > 0 && (
        <Text style={styles.savings}>You saved {formatCurrency(totalSavings)}</Text>
      )}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
      </View>
      <View style={styles.paymentRow}>
        <Button
          title="Cash"
          variant={paymentMethod === 'cash' ? 'primary' : 'outline'}
          onPress={() => onPaymentMethodChange('cash')}
          size="sm"
          style={styles.paymentBtn}
        />
        <Button
          title="M-Pesa"
          variant={paymentMethod === 'mpesa' ? 'primary' : 'outline'}
          onPress={() => onPaymentMethodChange('mpesa')}
          size="sm"
          style={styles.paymentBtn}
        />
      </View>
      <Button title="Complete Sale" onPress={onCheckout} loading={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingTop: Spacing.md, marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  totalLabel: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  totalAmount: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  savings: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.success, textAlign: 'right', marginBottom: Spacing.xs },
  paymentRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  paymentBtn: { flex: 1 },
});