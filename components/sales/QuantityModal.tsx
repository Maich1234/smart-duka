import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface QuantityModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  productName: string;
  maxStock: number;
  loading?: boolean;
}

export const QuantityModal: React.FC<QuantityModalProps> = ({
  visible,
  onClose,
  onConfirm,
  productName,
  maxStock,
  loading = false,
}) => {
  const [quantity, setQuantity] = useState('1');

  const handleConfirm = () => {
    const qty = parseInt(quantity);
    if (!isNaN(qty) && qty > 0 && qty <= maxStock) {
      onConfirm(qty);
    } else {
      Alert.alert('Invalid Quantity', `Quantity must be between 1 and ${maxStock}`);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Add to Cart</Text>
      <Text style={styles.productName}>{productName}</Text>
      <Text style={styles.maxStock}>Available: {maxStock}</Text>
      <Input label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
      <View style={styles.buttonRow}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flexBtn} />
        <Button title="Add" onPress={handleConfirm} loading={loading} style={styles.flexBtn} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.sm, textAlign: 'center', color: Colors.textPrimary },
  productName: { fontSize: Typography.size.body, textAlign: 'center', marginBottom: Spacing.xs },
  maxStock: { fontSize: Typography.size.small, textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.md },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
});