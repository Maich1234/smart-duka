import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
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
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
          {item.variantName ? ` (${item.variantName})` : ''}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {quantityLabel} · {formatCurrency(price, currency)}
          {item.bundleComponentNames?.length ? ` · ${item.bundleComponentNames.join(', ')}` : ''}
        </Text>
        {discountAmount > 0 && (
          <Text style={styles.promo} numberOfLines={1}>
            {appliedPromotionLabel} · saved {formatCurrency(discountAmount, currency)}
          </Text>
        )}
        {!!commissionPerUnit && (
          <Text style={styles.commission} numberOfLines={1}>
            You earn {formatCurrency(commissionPerUnit * item.quantity, currency)}
          </Text>
        )}
        {!!onQuantityChange && <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
          <Text style={styles.meta}>Qty{isDecimalUnit ? ` (${item.unitOfMeasure})` : ''}</Text>
          <QuantityEditor quantity={item.quantity} wholeUnits={!isDecimalUnit} onChange={onQuantityChange} disabled={disabled} />
        </View>}
      </View>
      <Text style={styles.subtotal}>{formatCurrency(subtotal, currency)}</Text>
      <AnimatedPressable
        onPress={onRemove}
        disabled={disabled}
        style={styles.removeBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={`Remove ${item.name} from sale`}
        accessibilityRole="button"
      >
        <Ionicons name="close" size={17} color={Colors.textSecondary} />
      </AnimatedPressable>
    </Animated.View>
  );
};

const QuantityEditor = ({ quantity, wholeUnits, onChange, disabled }: {
  quantity: number; wholeUnits: boolean; onChange: (quantity: number) => void; disabled: boolean;
}) => {
  const [value, setValue] = useState(String(quantity));
  const commit = () => {
    const parsed = parseSaleNumber(value, wholeUnits);
    if (parsed == null) setValue(String(quantity));
    else onChange(parsed);
  };
  return <TextInput
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
    style={{ minWidth: 52, minHeight: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, color: Colors.textPrimary, textAlign: 'center', paddingHorizontal: 6 }}
  />;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 8,
    // No divider between lines: two or three items with a rule under each
    // reads as a table. Spacing separates them.
    minHeight: 46,
  },
  info: { flex: 1, gap: 1 },
  name: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  meta: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamily, color: Colors.textSecondary },
  promo: { fontSize: Typography.size.caption, color: Colors.success },
  commission: { fontSize: Typography.size.caption, color: Colors.success, fontFamily: Typography.fontFamilySemiBold },
  subtotal: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  // A quiet close, not a red bin: removing a mistyped line is routine, and
  // the loudest control on a till should be the one that completes the sale.
  removeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
