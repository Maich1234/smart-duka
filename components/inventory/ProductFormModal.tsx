import React from 'react';
import { Modal, ScrollView, View, Text, StyleSheet } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface ProductFormData {
  name: string;
  category: string;
  sellingPrice: string;
  costPrice: string;
  quantity: string;
  lowStockAlert: string;
}

interface ProductFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  form: ProductFormData;
  setForm: (form: ProductFormData) => void;
  isEditing: boolean;
  loading?: boolean;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  visible,
  onClose,
  onSave,
  form,
  setForm,
  isEditing,
  loading = false,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.title}>{isEditing ? 'Edit Product' : 'Add Product'}</Text>
          <Input label="Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
          <Input label="Category" value={form.category} onChangeText={(t) => setForm({ ...form, category: t })} />
          <Input label="Selling Price" value={form.sellingPrice} onChangeText={(t) => setForm({ ...form, sellingPrice: t })} keyboardType="numeric" />
          <Input label="Cost Price" value={form.costPrice} onChangeText={(t) => setForm({ ...form, costPrice: t })} keyboardType="numeric" />
          <Input label="Quantity" value={form.quantity} onChangeText={(t) => setForm({ ...form, quantity: t })} keyboardType="numeric" />
          <Input label="Low Stock Alert" value={form.lowStockAlert} onChangeText={(t) => setForm({ ...form, lowStockAlert: t })} keyboardType="numeric" />
          <View style={styles.buttonRow}>
            <Button title="Cancel" variant="outline" onPress={onClose} />
            <Button title="Save" onPress={onSave} loading={loading} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.md },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 24, padding: Spacing.lg, maxHeight: '80%' },
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.md, color: Colors.textPrimary },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
});