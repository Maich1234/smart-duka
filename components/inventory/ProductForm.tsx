import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  BackHandler,
  type LayoutChangeEvent,
} from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SelectPicker, type PickerOption } from '../ui/SelectPicker';
import { HelpLink } from '../help/HelpLink';
import { ScreenHeader } from '../ui/ScreenHeader';
import { CommissionModal, type CommissionValue } from './CommissionModal';
import { useAlert } from '@/context/AlertContext';
import { formatCurrency } from '@/utils/formatters';
import { haptics } from '@/utils/haptics';
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
  /**
   * Identity of a saved variant, echoed back on update. Without it the server
   * mints fresh ids for the whole subdocument array, orphaning the `variantId`
   * on every past sale — and a staff edit is matched to its stored row by it.
   * Absent on a variant added in this session.
   */
  id?: string;
  name: string;
  sellingPrice: string;
  costPrice: string;
  quantity: string;
  lowStockAlert: string;
  commissionEnabled: boolean;
  commissionBasePrice: string;
  commissionEmployeeSharePercent: string;
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
  barcode?: string;
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
  // Product-level commission, honoured by every product type. Variants may
  // override it individually; those that don't inherit these values.
  commissionEnabled: boolean;
  commissionBasePrice: string;
  commissionEmployeeSharePercent: string;
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
  /** Categories this shop has already used, for the category picker. */
  categories?: string[];
  currency?: string;
  /**
   * Whether the viewer may set commission, and the cost of a *saved* variant.
   * Owner-only: commission decides what the shop pays the seller, which is not
   * the seller's call. Staff still maintain a variant's name, price, stock and
   * SKU — the server carries the protected fields over from the stored row.
   */
  canManageMargins?: boolean;
  /**
   * Whether the cost price field is shown. Everyone on a create — the server
   * requires it and there is no stored value to damage — but owner-only on an
   * edit, where staff hold a blank that would overwrite the real figure.
   * See MarginAccess in productPayload.ts.
   */
  canSetCostPrice?: boolean;
  /** True when `form.barcode` was seeded from a scanned code, not typed — shows a small confirmation hint under the field. */
  barcodePrefilled?: boolean;
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
  categories = [],
  currency = 'KES',
  canManageMargins = true,
  canSetCostPrice = true,
  barcodePrefilled = false,
}) => {
  const { alert } = useAlert();
  const update = (patch: Partial<ProductFormData>) => setForm({ ...form, ...patch });

  // Snapshot of the form as this screen was entered — an edit compares
  // against the real saved values, a create against the (possibly
  // barcode-prefilled) empty form. Only read inside handleCancel, so it's
  // fine that JSON.stringify isn't cheap; it never runs on a keystroke.
  const initialFormRef = useRef(form);
  const isDirty = useCallback(
    () => JSON.stringify(form) !== JSON.stringify(initialFormRef.current),
    [form]
  );

  // Leaving mid-edit silently loses changes, so the header back button, the
  // Cancel button, and the hardware back gesture all run this — same shape
  // as PosScreen's confirmLeave for an in-progress sale.
  const handleCancel = useCallback(() => {
    if (!isDirty()) {
      onCancel();
      return;
    }
    alert({
      type: 'confirm',
      title: 'Discard Changes?',
      message: isEditing
        ? 'You have unsaved changes to this product. Leaving now will discard them.'
        : 'You have unsaved changes. Leaving now will discard this product.',
      buttons: [
        { label: 'Keep Editing', variant: 'ghost' },
        { label: 'Discard', variant: 'danger', onPress: onCancel },
      ],
    });
  }, [isDirty, alert, isEditing, onCancel]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (!isDirty()) return false;
        handleCancel();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [isDirty, handleCancel])
  );

  // Categories are stored lowercase; the picker shows them capitalized for
  // readability but always writes back the same lowercase value that's
  // already sent on save (see buildProductPayload), so display casing here
  // never affects what's actually stored or matched against.
  // Memoized: `form` (and so this component) re-renders on every keystroke
  // anywhere in this fairly large form, and `categories` only changes when
  // the underlying query result does.
  const categoryOptions: PickerOption[] = useMemo(
    () => categories.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
    [categories],
  );

  // Both screens that host this form live inside the owner tab group, whose
  // tab bar is absolutely positioned over the content — a fixed bottom pad
  // left Save/Add Product sitting underneath it.
  const tabBarHeight = useTabBarHeight();

  // ── Field-level validation ──
  // Tracks each required field's Y offset inside the ScrollView (captured via
  // onLayout) so a failed save can scroll straight to the first problem
  // instead of leaving the user to hunt for a generic "fill out all fields"
  // toast.
  const scrollRef = useRef<ScrollView>(null);
  // Held as a ref, not unwrapped to `.current` here — reading a ref during
  // render is what the react-hooks/refs rule forbids, and both accesses below
  // happen inside callbacks (onLayout, and save) where it's legitimate.
  const fieldY = useRef<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // null = closed, 'product' = the product-level config, a number = that variant's override.
  const [commissionTarget, setCommissionTarget] = useState<'product' | number | null>(null);
  // Written through one stable callback rather than a per-field factory. The
  // factory was invoked during render to build each onLayout handler, which is
  // indistinguishable to react-hooks/refs from reading the ref during render;
  // here only the key and the measured y cross that boundary.
  const setFieldY = useCallback((key: string, y: number) => {
    fieldY.current[key] = y;
  }, []);
  const registerFieldY = (key: string) => (e: LayoutChangeEvent) =>
    setFieldY(key, e.nativeEvent.layout.y);

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Product name is required';
    if (!form.category.trim()) errs.category = 'Category is required';
    if (!form.sellingPrice.trim()) {
      errs.sellingPrice = `${form.productType === 'bundle' ? 'Bundle' : form.productType === 'configurable' ? 'Base' : 'Selling'} price is required`;
    } else if (isNaN(parseFloat(form.sellingPrice)) || parseFloat(form.sellingPrice) < 0) {
      errs.sellingPrice = 'Enter a valid selling price';
    }
    // Only demanded when the viewer can see it — staff are shown a blank
    // field they have no way to fill correctly.
    if (canSetCostPrice) {
      if (!form.costPrice.trim()) {
        errs.costPrice = 'Cost price is required';
      } else if (isNaN(parseFloat(form.costPrice)) || parseFloat(form.costPrice) < 0) {
        errs.costPrice = 'Enter a valid cost price';
      }
    }
    if (form.productType === 'bundle' && form.bundleItems.length === 0) {
      errs.bundleItems = 'Add at least one item to the bundle';
    }
    if (form.productType === 'configurable' && form.variants.length === 0) {
      errs.variants = 'Add at least one variant';
    }
    return errs;
  };

  const handleSavePress = () => {
    const errs = validate();
    setErrors(errs);
    const firstErrorKey = Object.keys(errs)[0];
    if (firstErrorKey) {
      haptics.error();
      const y = fieldY.current[firstErrorKey];
      if (y !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - Spacing.lg), animated: true });
      }
      return;
    }
    onSave();
  };

  const addBundleItem = () => {
    const first = availableProducts[0];
    if (!first) return;
    update({ bundleItems: [...form.bundleItems, { product: first._id, quantity: '1' }] });
    if (errors.bundleItems) setErrors((e) => ({ ...e, bundleItems: '' }));
  };
  const updateBundleItem = (index: number, patch: Partial<BundleItemForm>) => {
    const next = form.bundleItems.map((b, i) => (i === index ? { ...b, ...patch } : b));
    update({ bundleItems: next });
  };
  const removeBundleItem = (index: number) => {
    update({ bundleItems: form.bundleItems.filter((_, i) => i !== index) });
  };

  const addVariant = () => {
    update({
      variants: [
        ...form.variants,
        {
          name: '',
          sellingPrice: '',
          costPrice: '',
          quantity: '0',
          lowStockAlert: '5',
          commissionEnabled: false,
          commissionBasePrice: '',
          commissionEmployeeSharePercent: '100',
        },
      ],
    });
    if (errors.variants) setErrors((e) => ({ ...e, variants: '' }));
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
  // Margin is derived from the cost price, which staff never receive — the
  // badge would read as a 100% margin on a blank field.
  const showProfitBadge = canSetCostPrice && selling > 0 && form.costPrice !== '';
  const marginClamped = Math.max(0, Math.min(100, marginPct));
  const barColor = marginPct >= 0 ? Colors.accent : Colors.danger;

  const isComposite = form.productType === 'bundle' || form.productType === 'configurable';

  return (
    <View style={styles.wrapper}>
      {/* The host Screen already applies the top inset, so this header must not. */}
      <ScreenHeader
        title={isEditing ? 'Edit Product' : 'Add Product'}
        subtitle={isEditing ? 'Update product details' : 'Create a new product for your inventory'}
        onBack={handleCancel}
        insetTop={false}
        right={<HelpLink slug="product-types" label="Help" />}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.xl }]}
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
        <View style={styles.card} onLayout={registerFieldY('name')}>
          <Input
            label="Product Name"
            placeholder="e.g. Coca Cola 500ml"
            value={form.name}
            onChangeText={(t) => { update({ name: t }); if (errors.name) setErrors((e) => ({ ...e, name: '' })); }}
            error={errors.name}
          />
          <View style={styles.row}>
            <View style={styles.flexInput} onLayout={registerFieldY('category')}>
              <SelectPicker
                label="Category"
                placeholder="Select category"
                value={form.category}
                options={categoryOptions}
                onChange={(v) => { update({ category: v }); if (errors.category) setErrors((e) => ({ ...e, category: '' })); }}
                searchable={categoryOptions.length > 5}
                allowCustom
                customLabel="Other"
                customPlaceholder="Type a new category"
                error={errors.category}
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
          <Input
            label="Barcode (Optional)"
            placeholder="e.g. 6161101234567"
            value={form.barcode || ''}
            onChangeText={(t) => update({ barcode: t })}
            rightIcon="scan-outline"
            hint={barcodePrefilled ? 'Filled from the scanned barcode' : undefined}
          />
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
        <View style={styles.card} onLayout={registerFieldY('sellingPrice')}>
          <View style={styles.priceCardRow}>
            <View style={styles.priceBox}>
              <Text style={[styles.priceLabel, errors.sellingPrice && styles.priceLabelError]}>
                {form.productType === 'bundle'
                  ? 'Bundle Price'
                  : form.productType === 'configurable'
                  ? 'Base Price'
                  : 'Selling Price'}
              </Text>
              <View style={[styles.priceInputRow, errors.sellingPrice && styles.priceInputRowError]}>
                <Text style={styles.priceCurrency}>{currency}</Text>
                <TextInput
                  style={styles.priceValue}
                  value={form.sellingPrice}
                  onChangeText={(t) => { update({ sellingPrice: t }); if (errors.sellingPrice) setErrors((e) => ({ ...e, sellingPrice: '' })); }}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
              {errors.sellingPrice && (
                <View style={styles.priceErrorRow}>
                  <Ionicons name="alert-circle-outline" size={12} color={Colors.danger} />
                  <Text style={styles.priceErrorText}>{errors.sellingPrice}</Text>
                </View>
              )}
            </View>
            {canSetCostPrice && (
              <>
                <View style={styles.priceSeparator} />
                <View style={styles.priceBox}>
                  <Text style={[styles.priceLabel, errors.costPrice && styles.priceLabelError]}>Cost Price</Text>
                  <View style={[styles.priceInputRow, errors.costPrice && styles.priceInputRowError]}>
                    <Text style={styles.priceCurrency}>{currency}</Text>
                    <TextInput
                      style={styles.priceValue}
                      value={form.costPrice}
                      onChangeText={(t) => { update({ costPrice: t }); if (errors.costPrice) setErrors((e) => ({ ...e, costPrice: '' })); }}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={Colors.textTertiary}
                    />
                  </View>
                  {errors.costPrice && (
                    <View style={styles.priceErrorRow}>
                      <Ionicons name="alert-circle-outline" size={12} color={Colors.danger} />
                      <Text style={styles.priceErrorText}>{errors.costPrice}</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>

          {canSetCostPrice && selling > 0 && (
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
                      <TextInput
                        style={styles.stepperValueInput}
                        value={form.quantity || '0'}
                        onChangeText={(t) => update({ quantity: t.replace(/[^0-9]/g, '') })}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        accessibilityLabel="Quantity in stock"
                      />
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
                      <TextInput
                        style={styles.stepperValueInput}
                        value={form.lowStockAlert || '5'}
                        onChangeText={(t) => update({ lowStockAlert: t.replace(/[^0-9]/g, '') })}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        accessibilityLabel="Low stock alert threshold"
                      />
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
              <Text style={styles.hint}>You&apos;ll be notified when stock reaches this level.</Text>
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
            <View style={styles.sectionLabelRow} onLayout={registerFieldY('bundleItems')}>
              <Text style={styles.sectionLabel}>Includes</Text>
              <HelpLink slug="bundles-recipes" label="How bundles work" />
            </View>
            {errors.bundleItems && (
              <View style={styles.priceErrorRow}>
                <Ionicons name="alert-circle-outline" size={13} color={Colors.danger} />
                <Text style={styles.priceErrorText}>{errors.bundleItems}</Text>
              </View>
            )}
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

        {/* ── Employee commission ──
            Available on every product type. It used to exist only on
            `configurable` variants, so an ordinary shop could switch
            "show commission to staff" on and never generate any. Bundles are
            included: staff push them, so they are worth incentivising.

            Owner-only: the base price is the shop's floor, which never
            reaches a staff device. */}
        {canManageMargins && (
        <>
        <Text style={styles.sectionLabel}>Employee Commission</Text>
        <View style={styles.card}>
          <AnimatedPressable
            style={styles.commissionRow}
            onPress={() => setCommissionTarget('product')}
            accessibilityRole="button"
            accessibilityLabel="Set employee commission for this product"
            accessibilityState={{ checked: form.commissionEnabled }}
          >
            <Ionicons
              name={form.commissionEnabled ? 'cash' : 'cash-outline'}
              size={20}
              color={form.commissionEnabled ? Colors.primary : Colors.textSecondary}
            />
            <View style={styles.commissionRowText}>
              <Text style={styles.commissionRowTitle}>
                {form.commissionEnabled ? 'Commission enabled' : 'No commission'}
              </Text>
              <Text style={styles.commissionRowSub}>
                {form.commissionEnabled
                  ? `Employee gets ${form.commissionEmployeeSharePercent}% of anything above ${formatCurrency(parseFloat(form.commissionBasePrice) || 0, currency)}`
                  : 'Pay staff a share of what they sell this above your floor price'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </AnimatedPressable>
        </View>
        </>
        )}

        {/* ── Configurable variants ── */}
        {form.productType === 'configurable' && (
          <>
            <Text style={styles.sectionLabel} onLayout={registerFieldY('variants')}>Variants</Text>
            {errors.variants && (
              <View style={styles.priceErrorRow}>
                <Ionicons name="alert-circle-outline" size={13} color={Colors.danger} />
                <Text style={styles.priceErrorText}>{errors.variants}</Text>
              </View>
            )}
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
                    {/* Owner-only — the base price behind it is the shop's floor. */}
                    {canManageMargins && (
                      <AnimatedPressable
                        onPress={() => setCommissionTarget(i)}
                        style={styles.removeBtn}
                        hitSlop={HIT_SLOP}
                        accessibilityLabel="Set employee commission"
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name={v.commissionEnabled ? 'cash' : 'cash-outline'}
                          size={18}
                          color={v.commissionEnabled ? Colors.primary : Colors.textSecondary}
                        />
                      </AnimatedPressable>
                    )}
                    {/* Removing a saved variant takes away its stock and the
                        history hanging off it, so it stays an owner act — the
                        server keeps any stored variant staff omit. A row added
                        in this session was never saved, so it can go. */}
                    {(canManageMargins || !v.id) && (
                      <AnimatedPressable
                        onPress={() => removeVariant(i)}
                        style={styles.removeBtn}
                        hitSlop={HIT_SLOP}
                        accessibilityLabel="Remove variant"
                        accessibilityRole="button"
                      >
                        <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                      </AnimatedPressable>
                    )}
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
                    {(canManageMargins || !v.id) && (
                      <View style={styles.flexInput}>
                        <Input
                          placeholder="Cost"
                          value={v.costPrice}
                          onChangeText={(t) => updateVariant(i, { costPrice: t })}
                          keyboardType="numeric"
                        />
                      </View>
                    )}
                    <View style={styles.flexInput}>
                      <Input
                        placeholder="Stock"
                        value={v.quantity}
                        onChangeText={(t) => updateVariant(i, { quantity: t })}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  {canManageMargins && !v.commissionEnabled && form.commissionEnabled && (
                    <Text style={styles.commissionInherited}>
                      Uses the product commission
                    </Text>
                  )}
                  {v.commissionEnabled && (
                    <Text style={styles.commissionBadge}>
                      Commission: employee gets {v.commissionEmployeeSharePercent}% of the excess over{' '}
                      {formatCurrency(parseFloat(v.commissionBasePrice) || 0, currency)}
                    </Text>
                  )}
                </View>
              ))}
              <Button title="+ Add Variant" variant="outline" size="sm" onPress={addVariant} />
            </View>
          </>
        )}

        {typeof commissionTarget === 'number' && form.variants[commissionTarget] && (
          <CommissionModal
            visible
            onClose={() => setCommissionTarget(null)}
            subjectName={form.variants[commissionTarget].name}
            scopeLabel="this variant"
            sellingPrice={parseFloat(form.variants[commissionTarget].sellingPrice) || 0}
            initialValue={{
              enabled: form.variants[commissionTarget].commissionEnabled,
              basePrice: form.variants[commissionTarget].commissionBasePrice,
              employeeSharePercent: form.variants[commissionTarget].commissionEmployeeSharePercent,
            }}
            onConfirm={(value: CommissionValue) => {
              updateVariant(commissionTarget, {
                commissionEnabled: value.enabled,
                commissionBasePrice: value.basePrice,
                commissionEmployeeSharePercent: value.employeeSharePercent,
              });
              setCommissionTarget(null);
            }}
          />
        )}

        {commissionTarget === 'product' && (
          <CommissionModal
            visible
            onClose={() => setCommissionTarget(null)}
            subjectName={form.name || 'This product'}
            scopeLabel="this product"
            sellingPrice={parseFloat(form.sellingPrice) || 0}
            priceVaries={form.productType === 'variable' || (form.productType === 'service' && form.allowPriceOverride)}
            initialValue={{
              enabled: form.commissionEnabled,
              basePrice: form.commissionBasePrice,
              employeeSharePercent: form.commissionEmployeeSharePercent,
            }}
            onConfirm={(value: CommissionValue) => {
              update({
                commissionEnabled: value.enabled,
                commissionBasePrice: value.basePrice,
                commissionEmployeeSharePercent: value.employeeSharePercent,
              });
              setCommissionTarget(null);
            }}
          />
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
          <Button title="Cancel" variant="outline" onPress={handleCancel} style={styles.flexBtn} />
          <Button
            title={isEditing ? 'Save Changes' : 'Add Product'}
            leftIcon={isEditing ? undefined : 'add-circle-outline'}
            onPress={handleSavePress}
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

  // ── Scroll content ──
  // paddingBottom is applied inline from the live tab-bar height.
  content: { padding: Spacing.md },

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
  priceLabelError: {
    color: Colors.danger,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    borderRadius: BorderRadius.sm,
  },
  priceInputRowError: {
    borderWidth: 1.5,
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: -6,
  },
  priceErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  priceErrorText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.danger,
    flex: 1,
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
  stepperValueInput: {
    flex: 1,
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    padding: 0,
    margin: 0,
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
  commissionBadge: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  commissionInherited: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  commissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  commissionRowText: { flex: 1 },
  commissionRowTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  commissionRowSub: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },

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
