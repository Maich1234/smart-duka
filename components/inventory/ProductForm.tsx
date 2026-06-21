import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import type { Product, ProductType, UnitOfMeasure } from '@/services/products';

export interface BundleItemForm {
  product: string;
  quantity: string;
}

export interface VariantForm {
  name: string;
  sellingPrice: string;
  costPrice: string;
  quantity: string;
  lowStockAlert: string;
}

export interface ProductFormData {
  name: string;
  category: string;
  sellingPrice: string;
  costPrice: string;
  quantity: string;
  lowStockAlert: string;
  productType: ProductType;
  unitOfMeasure: UnitOfMeasure;
  trackInventory: boolean;
  minPrice: string;
  maxPrice: string;
  allowPriceOverride: boolean;
  bundleItems: BundleItemForm[];
  variants: VariantForm[];
}

interface ProductFormProps {
  onCancel: () => void;
  onSave: () => void;
  form: ProductFormData;
  setForm: (form: ProductFormData) => void;
  isEditing: boolean;
  loading?: boolean;
  /** Other products in the shop, for picking bundle components (excludes the product being edited) */
  availableProducts?: Product[];
}

const TYPE_OPTIONS: { value: ProductType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'standard', label: 'Standard', icon: 'cube-outline' },
  { value: 'variable', label: 'Variable Price', icon: 'pricetags-outline' },
  { value: 'weighted', label: 'Weighted', icon: 'scale-outline' },
  { value: 'refillable', label: 'Refillable', icon: 'water-outline' },
  { value: 'service', label: 'Service', icon: 'construct-outline' },
  { value: 'bundle', label: 'Bundle', icon: 'gift-outline' },
  { value: 'configurable', label: 'Variants', icon: 'options-outline' },
];

const UNIT_OPTIONS: UnitOfMeasure[] = ['kg', 'g', 'l', 'ml'];
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Shared product form body — rendered full-screen by the new/edit routes
 * (app/(owner)/inventory/new.tsx, .../[id]/edit.tsx) instead of inside a
 * bottom sheet, since it covers 7 product types with deep conditional
 * sections that don't fit comfortably in a sheet.
 */
export const ProductForm: React.FC<ProductFormProps> = ({
  onCancel,
  onSave,
  form,
  setForm,
  isEditing,
  loading = false,
  availableProducts = [],
}) => {
  const update = (patch: Partial<ProductFormData>) => setForm({ ...form, ...patch });

  const addBundleItem = () => {
    const first = availableProducts[0];
    if (!first) return;
    update({ bundleItems: [...form.bundleItems, { product: first._id, quantity: '1' }] });
  };
  const updateBundleItem = (index: number, patch: Partial<BundleItemForm>) => {
    const next = form.bundleItems.map((b, i) => (i === index ? { ...b, ...patch } : b));
    update({ bundleItems: next });
  };
  const removeBundleItem = (index: number) => {
    update({ bundleItems: form.bundleItems.filter((_, i) => i !== index) });
  };

  const addVariant = () => {
    update({ variants: [...form.variants, { name: '', sellingPrice: '', costPrice: '', quantity: '0', lowStockAlert: '5' }] });
  };
  const updateVariant = (index: number, patch: Partial<VariantForm>) => {
    const next = form.variants.map((v, i) => (i === index ? { ...v, ...patch } : v));
    update({ variants: next });
  };
  const removeVariant = (index: number) => {
    update({ variants: form.variants.filter((_, i) => i !== index) });
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
        {TYPE_OPTIONS.map((opt) => {
          const active = form.productType === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.typeChip, active && styles.typeChipActive]}
              onPress={() => update({ productType: opt.value })}
              activeOpacity={0.8}
            >
              <Ionicons name={opt.icon} size={16} color={active ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Input label="Name" value={form.name} onChangeText={(t) => update({ name: t })} />
      <Input label="Category" value={form.category} onChangeText={(t) => update({ category: t })} />

      <Input
        label={form.productType === 'bundle' ? 'Bundle Price' : form.productType === 'configurable' ? 'Base Price (display only)' : 'Selling Price'}
        value={form.sellingPrice}
        onChangeText={(t) => update({ sellingPrice: t })}
        keyboardType="numeric"
      />
      <Input label="Cost Price" value={form.costPrice} onChangeText={(t) => update({ costPrice: t })} keyboardType="numeric" />

      {form.productType !== 'bundle' && form.productType !== 'configurable' && (
        <Input
          label={form.productType === 'service' ? 'Available (leave 0 if unlimited)' : 'Quantity'}
          value={form.quantity}
          onChangeText={(t) => update({ quantity: t })}
          keyboardType="numeric"
        />
      )}
      {form.productType !== 'bundle' && form.productType !== 'configurable' && (
        <Input label="Low Stock Alert" value={form.lowStockAlert} onChangeText={(t) => update({ lowStockAlert: t })} keyboardType="numeric" />
      )}

      {(form.productType === 'weighted' || form.productType === 'refillable') && (
        <>
          <Text style={styles.sectionLabel}>Unit of Measure</Text>
          <View style={styles.unitRow}>
            {UNIT_OPTIONS.map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.unitChip, form.unitOfMeasure === u && styles.typeChipActive]}
                onPress={() => update({ unitOfMeasure: u })}
              >
                <Text style={[styles.typeChipText, form.unitOfMeasure === u && styles.typeChipTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>Selling Price above is interpreted as price per {form.unitOfMeasure}</Text>
        </>
      )}

      {form.productType === 'variable' && (
        <View style={styles.row}>
          <View style={styles.flexInput}>
            <Input label="Min Price (optional)" value={form.minPrice} onChangeText={(t) => update({ minPrice: t })} keyboardType="numeric" />
          </View>
          <View style={styles.flexInput}>
            <Input label="Max Price (optional)" value={form.maxPrice} onChangeText={(t) => update({ maxPrice: t })} keyboardType="numeric" />
          </View>
        </View>
      )}

      {form.productType === 'service' && (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Allow price override at checkout</Text>
          <Switch value={form.allowPriceOverride} onValueChange={(v) => update({ allowPriceOverride: v })} />
        </View>
      )}

      {form.productType !== 'standard' && form.productType !== 'weighted' && form.productType !== 'refillable' && form.productType !== 'bundle' && form.productType !== 'configurable' && (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Track inventory</Text>
          <Switch value={form.trackInventory} onValueChange={(v) => update({ trackInventory: v })} />
        </View>
      )}

      {form.productType === 'bundle' && (
        <>
          <Text style={styles.sectionLabel}>Includes</Text>
          {form.bundleItems.map((item, i) => (
            <View key={i} style={styles.bundleRow}>
              <View style={styles.bundlePicker}>
                {availableProducts.map((p) => (
                  <TouchableOpacity
                    key={p._id}
                    style={[styles.unitChip, item.product === p._id && styles.typeChipActive]}
                    onPress={() => updateBundleItem(i, { product: p._id })}
                  >
                    <Text style={[styles.typeChipText, item.product === p._id && styles.typeChipTextActive]} numberOfLines={1}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.qtyInput}>
                <Input
                  value={item.quantity}
                  onChangeText={(t) => updateBundleItem(i, { quantity: t })}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity
                onPress={() => removeBundleItem(i)}
                style={styles.removeBtn}
                hitSlop={HIT_SLOP}
                accessibilityLabel="Remove bundle item"
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <Button title="+ Add Item" variant="outline" size="sm" onPress={addBundleItem} disabled={availableProducts.length === 0} />
          {availableProducts.length === 0 && <Text style={styles.hint}>Create some standard products first to bundle them.</Text>}
        </>
      )}

      {form.productType === 'configurable' && (
        <>
          <Text style={styles.sectionLabel}>Variants</Text>
          {form.variants.map((v, i) => (
            <View key={i} style={styles.variantCard}>
              <View style={styles.variantHeader}>
                <View style={styles.flexInput}>
                  <Input
                    placeholder="Variant name (e.g. Large)"
                    value={v.name}
                    onChangeText={(t) => updateVariant(i, { name: t })}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => removeVariant(i)}
                  style={styles.removeBtn}
                  hitSlop={HIT_SLOP}
                  accessibilityLabel="Remove variant"
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
              <View style={styles.row}>
                <View style={styles.flexInput}>
                  <Input placeholder="Price" value={v.sellingPrice} onChangeText={(t) => updateVariant(i, { sellingPrice: t })} keyboardType="numeric" />
                </View>
                <View style={styles.flexInput}>
                  <Input placeholder="Cost" value={v.costPrice} onChangeText={(t) => updateVariant(i, { costPrice: t })} keyboardType="numeric" />
                </View>
                <View style={styles.flexInput}>
                  <Input placeholder="Stock" value={v.quantity} onChangeText={(t) => updateVariant(i, { quantity: t })} keyboardType="numeric" />
                </View>
              </View>
            </View>
          ))}
          <Button title="+ Add Variant" variant="outline" size="sm" onPress={addVariant} />
        </>
      )}

      <View style={styles.buttonRow}>
        <Button title="Cancel" variant="outline" onPress={onCancel} style={styles.flexBtn} />
        <Button title={isEditing ? 'Save Changes' : 'Add Product'} onPress={onSave} loading={loading} style={styles.flexBtn} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionLabel: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.xs },
  hint: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginBottom: Spacing.sm },

  typeRow: { marginBottom: Spacing.md },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary },
  typeChipTextActive: { color: Colors.white },

  unitRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm, flexWrap: 'wrap' },
  unitChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },

  row: { flexDirection: 'row', gap: Spacing.sm },
  flexInput: { flex: 1 },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  switchLabel: { fontSize: Typography.size.small, color: Colors.textPrimary },

  bundleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  bundlePicker: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  qtyInput: { width: 60 },
  removeBtn: { padding: Spacing.xs },

  variantCard: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  variantHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
});
