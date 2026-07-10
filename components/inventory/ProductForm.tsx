import React from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SelectPicker, type PickerOption } from '../ui/SelectPicker';
import { HelpLink } from '../help/HelpLink';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { UNITS_OF_MEASURE } from '@/constants/presets';
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

export interface PromotionForm {
  label: string;
  buyQty: string;
  freeQty: string;
  isActive: boolean;
}

export interface ProductFormData {
  name: string;
  category: string;
  sku?: string;
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
  hasPromotions: boolean;
  promotions: PromotionForm[];
}

interface ProductFormProps {
  onCancel: () => void;
  onSave: () => void;
  form: ProductFormData;
  setForm: (form: ProductFormData) => void;
  isEditing: boolean;
  loading?: boolean;
  availableProducts?: Product[];
  currency?: string;
}

const TYPE_OPTIONS: {
  value: ProductType;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'standard', label: 'Standard', sub: 'Fixed price', icon: 'cube-outline' },
  { value: 'variable', label: 'Variable Price', sub: 'Price may vary', icon: 'pricetags-outline' },
  { value: 'weighted', label: 'Weighted', sub: 'Sold by weight', icon: 'scale-outline' },
  { value: 'refillable', label: 'Refillable', sub: 'Refill tracking', icon: 'water-outline' },
  { value: 'service', label: 'Service', sub: 'Service item', icon: 'construct-outline' },
  { value: 'bundle', label: 'Bundle', sub: 'Product bundle', icon: 'gift-outline' },
  { value: 'configurable', label: 'Variants', sub: 'Multi-variant', icon: 'options-outline' },
];

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export const ProductForm: React.FC<ProductFormProps> = ({
  onCancel,
  onSave,
  form,
  setForm,
  isEditing,
  loading = false,
  availableProducts = [],
  currency = 'KES',
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

  const addPromotion = () => {
    update({ promotions: [...form.promotions, { label: '', buyQty: '4', freeQty: '1', isActive: true }] });
  };
  const updatePromotion = (index: number, patch: Partial<PromotionForm>) => {
    const next = form.promotions.map((p, i) => (i === index ? { ...p, ...patch } : p));
    update({ promotions: next });
  };
  const removePromotion = (index: number) => {
    update({ promotions: form.promotions.filter((_, i) => i !== index) });
  };

  const stepQuantity = (delta: number) => {
    const val = Math.max(0, (parseInt(form.quantity) || 0) + delta);
    update({ quantity: String(val) });
  };
  const stepLowStock = (delta: number) => {
    const val = Math.max(0, (parseInt(form.lowStockAlert) || 5) + delta);
    update({ lowStockAlert: String(val) });
  };

  const selling = parseFloat(form.sellingPrice) || 0;
  const cost = parseFloat(form.costPrice) || 0;
  const profit = selling - cost;
  const marginPct = selling > 0 ? (profit / selling) * 100 : 0;
  const showProfitBadge = selling > 0 && form.costPrice !== '';
  const marginClamped = Math.max(0, Math.min(100, marginPct));
  const barColor = marginPct >= 0 ? Colors.accent : Colors.danger;

  const isComposite = form.productType === 'bundle' || form.productType === 'configurable';

  return (
    <View style={styles.wrapper}>
      {/* Custom header */}
      <View style={styles.header}>
        <AnimatedPressable
          style={styles.backBtn}
          onPress={onCancel}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </AnimatedPressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Product' : 'Add Product'}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {isEditing ? 'Update product details' : 'Create a new product for your inventory'}
          </Text>
        </View>
        <HelpLink slug="product-types" label="Help" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {/* ── Product Type ── */}
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Product Type</Text>
          <HelpLink slug="product-types" label="What's the difference?" />
        </View>
        <View style={styles.typeGrid}>
          {TYPE_OPTIONS.map((opt) => {
            const active = form.productType === opt.value;
            return (
              <AnimatedPressable
                key={opt.value}
                style={[styles.typeCard, active && styles.typeCardActive]}
                onPress={() => update({ productType: opt.value })}
              >
                {active && (
                  <View style={styles.typeCardCheck}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                  </View>
                )}
                <View style={[styles.typeCardIconBox, active && styles.typeCardIconBoxActive]}>
                  <Ionicons name={opt.icon} size={18} color={active ? Colors.white : Colors.textSecondary} />
                </View>
                <Text style={[styles.typeCardLabel, active && styles.typeCardLabelActive]} numberOfLines={1}>
                  {opt.label}
                </Text>
                <Text style={styles.typeCardSub} numberOfLines={1}>{opt.sub}</Text>
              </AnimatedPressable>
            );
          })}
        </View>

        {/* ── Basic Information ── */}
        <Text style={styles.sectionLabel}>Basic Information</Text>
        <View style={styles.card}>
          <Input
            label="Product Name"
            placeholder="e.g. Coca Cola 500ml"
            value={form.name}
            onChangeText={(t) => update({ name: t })}
          />
          <View style={styles.row}>
            <View style={styles.flexInput}>
              <Input
                label="Category"
                placeholder="Select category"
                value={form.category}
                onChangeText={(t) => update({ category: t })}
                rightIcon="chevron-down"
              />
            </View>
            <View style={styles.flexInput}>
              <Input
                label="SKU (Optional)"
                placeholder="e.g. COLA-500"
                value={form.sku || ''}
                onChangeText={(t) => update({ sku: t })}
                rightIcon="barcode-outline"
              />
            </View>
          </View>
        </View>

        {/* ── Pricing ── */}
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Pricing</Text>
          {showProfitBadge && (
            <View style={styles.profitBadge}>
              <Ionicons name="diamond-outline" size={11} color={Colors.accent} />
              <Text style={styles.profitBadgeText}>
                Profit: {currency} {profit.toFixed(2)} ({marginPct.toFixed(0)}%)
              </Text>
            </View>
          )}
        </View>
        <View style={styles.card}>
          <View style={styles.priceCardRow}>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>
                {form.productType === 'bundle'
                  ? 'Bundle Price'
                  : form.productType === 'configurable'
                  ? 'Base Price'
                  : 'Selling Price'}
              </Text>
              <View style={styles.priceInputRow}>
                <Text style={styles.priceCurrency}>{currency}</Text>
                <TextInput
                  style={styles.priceValue}
                  value={form.sellingPrice}
                  onChangeText={(t) => update({ sellingPrice: t })}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            </View>
            <View style={styles.priceSeparator} />
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>Cost Price</Text>
              <View style={styles.priceInputRow}>
                <Text style={styles.priceCurrency}>{currency}</Text>
                <TextInput
                  style={styles.priceValue}
                  value={form.costPrice}
                  onChangeText={(t) => update({ costPrice: t })}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            </View>
          </View>

          {selling > 0 && (
            <>
              <View style={styles.marginLabelRow}>
                <Text style={styles.marginLabel}>Margin Preview</Text>
                <Text style={[styles.marginPct, { color: barColor }]}>
                  {marginPct.toFixed(0)}%
                </Text>
              </View>
              <View style={{ position: 'relative', height: 20, justifyContent: 'center', marginBottom: Spacing.xs }}>
                <View style={styles.marginBarTrack}>
                  <View
                    style={[
                      styles.marginBarFill,
                      { width: `${marginClamped}%` as any, backgroundColor: barColor },
                    ]}
                  />
                </View>
                <View
                  style={[
                    styles.marginBarThumb,
                    {
                      left: `${Math.min(97, marginClamped)}%` as any,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
            </>
          )}

          {form.productType === 'variable' && (
            <View style={[styles.row, { marginTop: Spacing.sm }]}>
              <View style={styles.flexInput}>
                <Input
                  label="Min Price (optional)"
                  value={form.minPrice}
                  onChangeText={(t) => update({ minPrice: t })}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.flexInput}>
                <Input
                  label="Max Price (optional)"
                  value={form.maxPrice}
                  onChangeText={(t) => update({ maxPrice: t })}
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}
        </View>

        {/* ── Unit of Measure (all types except bundle/configurable) ── */}
        {!isComposite && (
          <SelectPicker
            label="Unit of Measure"
            value={form.unitOfMeasure || 'unit'}
            options={UNITS_OF_MEASURE.map((u): PickerOption => ({
              value: u.value,
              label: u.label,
              rightText: u.abbreviation,
            }))}
            onChange={(v) => update({ unitOfMeasure: v as UnitOfMeasure })}
            leftIcon="scale-outline"
            searchable
          />
        )}

        {/* ── Service — price override ── */}
        {form.productType === 'service' && (
          <View style={[styles.card, styles.switchRow]}>
            <Text style={styles.switchLabel}>Allow price override at checkout</Text>
            <Switch
              value={form.allowPriceOverride}
              onValueChange={(v) => update({ allowPriceOverride: v })}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        )}

        {/* ── Inventory ── */}
        {!isComposite && (
          <>
            <Text style={styles.sectionLabel}>Inventory</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.flexInput}>
                  <View style={styles.stepperCard}>
                    <Text style={styles.stepperLabel}>Quantity in Stock</Text>
                    <View style={styles.stepperInner}>
                      <Text style={styles.stepperValue}>{form.quantity || '0'}</Text>
                      <View style={styles.stepperBtns}>
                        <AnimatedPressable style={styles.stepperBtn} onPress={() => stepQuantity(1)} hitSlop={HIT_SLOP}>
                          <Ionicons name="chevron-up" size={15} color={Colors.textSecondary} />
                        </AnimatedPressable>
                        <AnimatedPressable style={styles.stepperBtn} onPress={() => stepQuantity(-1)} hitSlop={HIT_SLOP}>
                          <Ionicons name="chevron-down" size={15} color={Colors.textSecondary} />
                        </AnimatedPressable>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.flexInput}>
                  <View style={styles.stepperCard}>
                    <Text style={styles.stepperLabel}>Low Stock Alert</Text>
                    <View style={styles.stepperInner}>
                      <Text style={styles.stepperValue}>{form.lowStockAlert || '5'}</Text>
                      <View style={styles.stepperBtns}>
                        <AnimatedPressable style={styles.stepperBtn} onPress={() => stepLowStock(1)} hitSlop={HIT_SLOP}>
                          <Ionicons name="chevron-up" size={15} color={Colors.textSecondary} />
                        </AnimatedPressable>
                        <AnimatedPressable style={styles.stepperBtn} onPress={() => stepLowStock(-1)} hitSlop={HIT_SLOP}>
                          <Ionicons name="chevron-down" size={15} color={Colors.textSecondary} />
                        </AnimatedPressable>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
              <Text style={styles.hint}>You'll be notified when stock reaches this level.</Text>
            </View>
          </>
        )}

        {/* ── Track inventory (service) ── */}
        {form.productType === 'service' && (
          <View style={[styles.card, styles.switchRow]}>
            <Text style={styles.switchLabel}>Track inventory</Text>
            <Switch
              value={form.trackInventory}
              onValueChange={(v) => update({ trackInventory: v })}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        )}

        {/* ── Bundle items ── */}
        {form.productType === 'bundle' && (
          <>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>Includes</Text>
              <HelpLink slug="bundles-recipes" label="How bundles work" />
            </View>
            <View style={styles.card}>
              {form.bundleItems.map((item, i) => (
                <View key={i} style={styles.bundleRow}>
                  <View style={styles.bundlePicker}>
                    {availableProducts.map((p) => (
                      <AnimatedPressable
                        key={p._id}
                        style={[styles.unitChip, item.product === p._id && styles.unitChipActive]}
                        onPress={() => updateBundleItem(i, { product: p._id })}
                      >
                        <Text
                          style={[styles.unitChipText, item.product === p._id && styles.unitChipTextActive]}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                      </AnimatedPressable>
                    ))}
                  </View>
                  <View style={styles.qtyInput}>
                    <Input
                      value={item.quantity}
                      onChangeText={(t) => updateBundleItem(i, { quantity: t })}
                      keyboardType="numeric"
                    />
                  </View>
                  <AnimatedPressable
                    onPress={() => removeBundleItem(i)}
                    style={styles.removeBtn}
                    hitSlop={HIT_SLOP}
                    accessibilityLabel="Remove bundle item"
                    accessibilityRole="button"
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </AnimatedPressable>
                </View>
              ))}
              <Button
                title="+ Add Item"
                variant="outline"
                size="sm"
                onPress={addBundleItem}
                disabled={availableProducts.length === 0}
              />
              {availableProducts.length === 0 && (
                <Text style={[styles.hint, { marginTop: Spacing.xs }]}>
                  Create some standard products first to bundle them.
                </Text>
              )}
            </View>
          </>
        )}

        {/* ── Configurable variants ── */}
        {form.productType === 'configurable' && (
          <>
            <Text style={styles.sectionLabel}>Variants</Text>
            <View style={styles.card}>
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
                    <AnimatedPressable
                      onPress={() => removeVariant(i)}
                      style={styles.removeBtn}
                      hitSlop={HIT_SLOP}
                      accessibilityLabel="Remove variant"
                      accessibilityRole="button"
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </AnimatedPressable>
                  </View>
                  <View style={styles.row}>
                    <View style={styles.flexInput}>
                      <Input
                        placeholder="Price"
                        value={v.sellingPrice}
                        onChangeText={(t) => updateVariant(i, { sellingPrice: t })}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.flexInput}>
                      <Input
                        placeholder="Cost"
                        value={v.costPrice}
                        onChangeText={(t) => updateVariant(i, { costPrice: t })}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.flexInput}>
                      <Input
                        placeholder="Stock"
                        value={v.quantity}
                        onChangeText={(t) => updateVariant(i, { quantity: t })}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              ))}
              <Button title="+ Add Variant" variant="outline" size="sm" onPress={addVariant} />
            </View>
          </>
        )}

        {/* ── Promotions & Discounts ── */}
        {!isComposite && (
          <>
            <Text style={styles.sectionLabel}>Promotions & Discounts</Text>
            <View style={styles.card}>
              <View style={styles.promoToggleRow}>
                <View style={styles.promoToggleIconBox}>
                  <Ionicons name="pricetag-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.promoToggleTextArea}>
                  <Text style={styles.promoToggleTitle}>Enable promotions / discounts</Text>
                  <Text style={styles.promoToggleSub}>Create offers and boost your sales</Text>
                </View>
                <Switch
                  value={form.hasPromotions}
                  onValueChange={(v) => update({ hasPromotions: v })}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>

              {form.hasPromotions && form.promotions.map((promo, i) => (
                <View key={i} style={styles.variantCard}>
                  <View style={styles.variantHeader}>
                    <View style={styles.flexInput}>
                      <Input
                        placeholder="Label (e.g. Buy 4 Get 1 Free)"
                        value={promo.label}
                        onChangeText={(t) => updatePromotion(i, { label: t })}
                      />
                    </View>
                    <AnimatedPressable
                      onPress={() => removePromotion(i)}
                      style={styles.removeBtn}
                      hitSlop={HIT_SLOP}
                      accessibilityLabel="Remove promotion"
                      accessibilityRole="button"
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </AnimatedPressable>
                  </View>
                  <View style={styles.row}>
                    <View style={styles.flexInput}>
                      <Input
                        placeholder="Buy Qty"
                        value={promo.buyQty}
                        onChangeText={(t) => updatePromotion(i, { buyQty: t })}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.flexInput}>
                      <Input
                        placeholder="Free Qty"
                        value={promo.freeQty}
                        onChangeText={(t) => updatePromotion(i, { freeQty: t })}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              ))}

              {form.hasPromotions && (
                <AnimatedPressable style={styles.addPromoDashed} onPress={addPromotion}>
                  <Ionicons name="add" size={18} color={Colors.primary} />
                  <View>
                    <Text style={styles.addPromoTitle}>Add Promotion</Text>
                    <Text style={styles.addPromoSub}>Add promotional offers or discounts</Text>
                  </View>
                </AnimatedPressable>
              )}
            </View>
          </>
        )}

        {/* ── Actions ── */}
        <View style={styles.buttonRow}>
          <Button title="Cancel" variant="outline" onPress={onCancel} style={styles.flexBtn} />
          <Button
            title={isEditing ? 'Save Changes' : 'Add Product'}
            leftIcon={isEditing ? undefined : 'add-circle-outline'}
            onPress={onSave}
            loading={loading}
            style={styles.flexBtn}
          />
        </View>

        {!isEditing && (
          <View style={styles.tipRow}>
            <Ionicons name="bulb-outline" size={14} color={Colors.accent} />
            <Text style={styles.tipText}>
              Tip: You can edit all details anytime after creating the product.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  // ── Scroll content ──
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },

  // ── Section labels ──
  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },

  // ── Card container ──
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // ── Product type grid ──
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  typeCard: {
    width: '31%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.sm,
    alignItems: 'flex-start',
    position: 'relative',
    minHeight: 84,
    gap: 4,
  },
  typeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  typeCardCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  typeCardIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  typeCardIconBoxActive: {
    backgroundColor: Colors.primary,
  },
  typeCardLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  typeCardLabelActive: {
    color: Colors.primary,
  },
  typeCardSub: {
    fontSize: 10,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },

  // ── Profit badge ──
  profitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  profitBadgeText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.accent,
  },

  // ── Price card ──
  priceCardRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  priceBox: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
  },
  priceSeparator: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  priceLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceCurrency: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    flex: 1,
    padding: 0,
  },

  // ── Margin bar ──
  marginLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  marginLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  marginPct: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  marginBarTrack: {
    height: 6,
    backgroundColor: Colors.divider,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  marginBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  marginBarThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: Colors.white,
    top: 2,
    transform: [{ translateX: -8 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },

  // ── Stepper cards ──
  stepperCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    backgroundColor: Colors.background,
  },
  stepperLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  stepperInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperValue: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  stepperBtns: {
    gap: 3,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },

  // ── Units ──
  unitRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.sm },
  unitChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  unitChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  unitChipText: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary },
  unitChipTextActive: { color: Colors.white },

  // ── Switch row (service) ──
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: Typography.size.small, color: Colors.textPrimary, fontFamily: Typography.fontFamily },

  // ── Promotions toggle ──
  promoToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  promoToggleIconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoToggleTextArea: { flex: 1 },
  promoToggleTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  promoToggleSub: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },

  // ── Add Promotion dashed button ──
  addPromoDashed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  addPromoTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  addPromoSub: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },

  // ── Bundle / variants / promos ──
  bundleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  bundlePicker: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  qtyInput: { width: 60 },
  removeBtn: { padding: Spacing.xs },
  variantCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  variantHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  // ── Shared ──
  row: { flexDirection: 'row', gap: Spacing.sm },
  flexInput: { flex: 1 },
  hint: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: Spacing.sm },

  // ── Actions ──
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  flexBtn: { flex: 1 },

  // ── Tip ──
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  tipText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.accent,
    flex: 1,
  },
});
