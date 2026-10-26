import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Motion } from '@/constants/Motion';
import { formatCurrency } from '@/utils/formatters';
import { parseSaleNumber } from '@/utils/saleInput';
import { applyBestPromotion } from '@/utils/promotions';
import type { BundleItem, ProductPromotion, UnitOfMeasure } from '@/services/products';

interface CartItemProps {
  item: {
    _id: string;
    name: string;
    sellingPrice: number;
    quantity: number;
    unitOfMeasure?: UnitOfMeasure;
    bundleItems?: BundleItem[];
    bundleComponentNames?: string[];
    variantName?: string;
    promotions?: ProductPromotion[];
  };
  /** Overrides item.sellingPrice when set — used for variable/service/configurable lines */
  unitPrice?: number;
  /** Employee's commission per unit for this line, if the shop shows it. */
  commissionPerUnit?: number;
  onRemove: () => void;
  currency?: string;
  onQuantityChange?: (quantity: number) => void;
  disabled?: boolean;
}

export const CartItem: React.FC<CartItemProps> = ({ item, unitPrice, commissionPerUnit, onRemove, currency, onQuantityChange, disabled = false }) => {
  const price = unitPrice ?? item.sellingPrice;
  const { subtotal, discountAmount, appliedPromotionLabel } = applyBestPromotion(item.promotions, item.quantity, price);
  const isDecimalUnit = !!item.unitOfMeasure && item.unitOfMeasure !== 'unit';
  const quantityLabel = isDecimalUnit ? `${item.quantity} ${item.unitOfMeasure}` : `x${item.quantity}`;

  return (
    <Animated.View
      style={styles.container}
      entering={FadeIn.duration(Motion.duration.base)}
      exiting={FadeOut.duration(Motion.duration.fast)}
      layout={LinearTransition.duration(Motion.duration.slow)}
    >
      <View style={styles.lineHeader}>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}{item.variantName ? ` · ${item.variantName}` : ''}</Text>
          <Text style={styles.meta}>{formatCurrency(price, currency)} each{item.bundleComponentNames?.length ? ` · ${item.bundleComponentNames.join(', ')}` : ''}</Text>
        </View>
        <Text style={styles.subtotal}>{formatCurrency(subtotal, currency)}</Text>
        <AnimatedPressable onPress={onRemove} disabled={disabled} style={styles.removeBtn} accessibilityLabel={`Remove ${item.name} from sale`} accessibilityRole="button">
          <Ionicons name="close" size={20} color={Colors.textSecondary} />
        </AnimatedPressable>
      </View>
      <View style={styles.lineControls}>
        <Text style={styles.meta}>{isDecimalUnit ? `Quantity (${item.unitOfMeasure})` : 'Quantity'}</Text>
        {onQuantityChange ? <QuantityEditor quantity={item.quantity} wholeUnits={!isDecimalUnit} onChange={onQuantityChange} disabled={disabled} /> : <Text style={styles.meta}>{quantityLabel}</Text>}
      </View>
      {discountAmount > 0 && <Text style={styles.promo}>{appliedPromotionLabel} · saved {formatCurrency(discountAmount, currency)}</Text>}
      {!!commissionPerUnit && <Text style={styles.commission}>You earn {formatCurrency(commissionPerUnit * item.quantity, currency)}</Text>}

    </Animated.View>
  );
};

const QuantityEditor = ({ quantity, wholeUnits, onChange, disabled }: {
  quantity: number; wholeUnits: boolean; onChange: (quantity: number) => void; disabled: boolean;
}) => {
  const [draft, setValue] = useState<string | null>(null);
  const value = draft ?? String(quantity);
  const commit = () => {
    const parsed = parseSaleNumber(value, wholeUnits);
    if (parsed != null) onChange(parsed);
    setValue(null);
  };
  return <View style={styles.stepper}>
    {wholeUnits && <AnimatedPressable accessibilityRole="button" accessibilityLabel="Decrease quantity" disabled={disabled || quantity <= 1} onPress={() => { setValue(null); onChange(quantity - 1); }} style={styles.stepButton}><Ionicons name="remove" size={18} color={disabled || quantity <= 1 ? Colors.textTertiary : Colors.primary} /></AnimatedPressable>}
    <TextInput
    value={value}
    onChangeText={(text) => {
      setValue(text);
      const parsed = parseSaleNumber(text, wholeUnits);
      if (parsed != null) onChange(parsed);
    }}
    onBlur={commit}
    keyboardType={wholeUnits ? 'number-pad' : 'decimal-pad'}
    editable={!disabled}
    accessibilityLabel="Quantity in this sale"
    style={styles.quantityInput}
  />
    {wholeUnits && <AnimatedPressable accessibilityRole="button" accessibilityLabel="Increase quantity" disabled={disabled} onPress={() => { setValue(null); onChange(quantity + 1); }} style={styles.stepButton}><Ionicons name="add" size={18} color={Colors.primary} /></AnimatedPressable>}
  </View>;
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    minHeight: 46,
  },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, overflow: 'hidden' },
  stepButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  quantityInput: { minWidth: 48, minHeight: 48, fontFamily: Typography.fontFamilySemiBold, fontSize: 14, color: Colors.textPrimary, textAlign: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  info: { flex: 1, gap: 4 },
  name: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  meta: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamily, color: Colors.textSecondary },
  promo: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamily, color: Colors.success },
  commission: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, color: Colors.success },
  subtotal: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  // A quiet close, not a red bin: removing a mistyped line is routine, and
  // the loudest control on a till should be the one that completes the sale.
  removeBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
