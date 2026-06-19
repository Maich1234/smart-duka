import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
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
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{isEditing ? 'Edit Product' : 'Add Product'}</Text>
        <Input label="Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
        <Input label="Category" value={form.category} onChangeText={(t) => setForm({ ...form, category: t })} />
        <Input label="Selling Price" value={form.sellingPrice} onChangeText={(t) => setForm({ ...form, sellingPrice: t })} keyboardType="numeric" />
        <Input label="Cost Price" value={form.costPrice} onChangeText={(t) => setForm({ ...form, costPrice: t })} keyboardType="numeric" />
        <Input label="Quantity" value={form.quantity} onChangeText={(t) => setForm({ ...form, quantity: t })} keyboardType="numeric" />
        <Input label="Low Stock Alert" value={form.lowStockAlert} onChangeText={(t) => setForm({ ...form, lowStockAlert: t })} keyboardType="numeric" />
        <View style={styles.buttonRow}>
          <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flexBtn} />
          <Button title="Save" onPress={onSave} loading={loading} style={styles.flexBtn} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.md, color: Colors.textPrimary },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
});