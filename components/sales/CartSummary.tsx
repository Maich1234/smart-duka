import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';
import { formatCurrency } from '@/utils/formatters';

interface CartSummaryProps {
  total: number;
  paymentMethod: 'cash' | 'mpesa';
  onPaymentMethodChange: (method: 'cash' | 'mpesa') => void;
  onCheckout: () => void;
  loading?: boolean;
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  total,
  paymentMethod,
  onPaymentMethodChange,
  onCheckout,
  loading = false,
}) => {
  return (
    <View style={styles.container}>
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
  container: { padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, marginTop: Spacing.sm, ...Shadows.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  totalLabel: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  totalAmount: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.success },
  paymentRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  paymentBtn: { flex: 1 },
});