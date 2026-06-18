import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface StockUpdateModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  currentStock: number;
  productName: string;
  loading?: boolean;
}

export const StockUpdateModal: React.FC<StockUpdateModalProps> = ({
  visible,
  onClose,
  onConfirm,
  currentStock,
  productName,
  loading = false,
}) => {
  const [quantity, setQuantity] = useState(currentStock.toString());

  const handleConfirm = () => {
    const qty = parseInt(quantity);
    if (!isNaN(qty) && qty >= 0) onConfirm(qty);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Update Stock</Text>
          <Text style={styles.productName}>{productName}</Text>
          <Text style={styles.currentStock}>Current stock: {currentStock}</Text>
          <Input label="New Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
          <View style={styles.buttonRow}>
            <Button title="Cancel" variant="outline" onPress={onClose} />
            <Button title="Update" onPress={handleConfirm} loading={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 24, padding: Spacing.lg, width: '90%' },
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.sm, color: Colors.textPrimary, textAlign: 'center' },
  productName: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, textAlign: 'center', marginBottom: Spacing.xs },
  currentStock: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
});