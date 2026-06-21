import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { formatCurrency } from '@/utils/formatters';
import type { ProductVariant } from '@/services/products';

interface VariantPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (variant: ProductVariant, quantity: number) => void;
  productName: string;
  variants: ProductVariant[];
  loading?: boolean;
}

export const VariantPickerModal: React.FC<VariantPickerModalProps> = ({
  visible,
  onClose,
  onConfirm,
  productName,
  variants,
  loading = false,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');

  useEffect(() => {
    if (visible) {
      setSelectedId(variants.find((v) => v.quantity > 0)?._id ?? variants[0]?._id ?? null);
      setQuantity('1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const selected = variants.find((v) => v._id === selectedId);

  const handleConfirm = () => {
    if (!selected) {
      Alert.alert('Select an option', 'Please choose a variant');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0 || qty > selected.quantity) {
      Alert.alert('Invalid Quantity', `Quantity must be between 1 and ${selected.quantity}`);
      return;
    }
    onConfirm(selected, qty);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Choose an Option</Text>
      <Text style={styles.productName}>{productName}</Text>

      <View style={styles.chipRow}>
        {variants.map((v) => {
          const active = v._id === selectedId;
          const outOfStock = v.quantity === 0;
          return (
            <TouchableOpacity
              key={v._id}
              style={[styles.chip, active && styles.chipActive, outOfStock && styles.chipDisabled]}
              onPress={() => !outOfStock && setSelectedId(v._id)}
              disabled={outOfStock}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{v.name}</Text>
              <Text style={[styles.chipPrice, active && styles.chipTextActive]}>
                {formatCurrency(v.sellingPrice)}{outOfStock ? ' · Out of stock' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selected && (
        <>
          <Text style={styles.maxStock}>Available: {selected.quantity}</Text>
          <Input label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
        </>
      )}

      <View style={styles.buttonRow}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flexBtn} />
        <Button title="Add" onPress={handleConfirm} loading={loading} style={styles.flexBtn} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.sm, textAlign: 'center', color: Colors.textPrimary },
  productName: { fontSize: Typography.size.body, textAlign: 'center', marginBottom: Spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, minWidth: 100 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  chipPrice: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
  chipTextActive: { color: Colors.white },
  maxStock: { fontSize: Typography.size.small, textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.sm },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
});
