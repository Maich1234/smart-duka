import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';

interface CartItemProps {
  item: {
    _id: string;
    name: string;
    sellingPrice: number;
    quantity: number;
  };
  onRemove: () => void;
  onQuantityChange?: (quantity: number) => void;
}

export const CartItem: React.FC<CartItemProps> = ({ item, onRemove, onQuantityChange }) => {
  const subtotal = item.sellingPrice * item.quantity;

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>{formatCurrency(item.sellingPrice)}</Text>
      </View>
      <View style={styles.controls}>
        <Text style={styles.quantity}>x{item.quantity}</Text>
        <Text style={styles.subtotal}>{formatCurrency(subtotal)}</Text>
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  info: { flex: 2 },
  name: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  price: { fontSize: Typography.size.small, color: Colors.textSecondary },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  quantity: { fontSize: Typography.size.body, color: Colors.textPrimary, minWidth: 40, textAlign: 'center' },
  subtotal: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.success, minWidth: 70, textAlign: 'right' },
  removeBtn: { padding: Spacing.xs },
});