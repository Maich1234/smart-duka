import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
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
      alert(`Quantity must be between 1 and ${maxStock}`);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Add to Cart</Text>
          <Text style={styles.productName}>{productName}</Text>
          <Text style={styles.maxStock}>Available: {maxStock}</Text>
          <Input label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
          <View style={styles.buttonRow}>
            <Button title="Cancel" variant="outline" onPress={onClose} />
            <Button title="Add" onPress={handleConfirm} loading={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 24, padding: Spacing.lg, width: '90%' },
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.sm, textAlign: 'center', color: Colors.textPrimary },
  productName: { fontSize: Typography.size.body, textAlign: 'center', marginBottom: Spacing.xs },
  maxStock: { fontSize: Typography.size.small, textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.md },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
});