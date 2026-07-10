import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';
import { formatCurrency } from '@/utils/formatters';
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
  onRemove: () => void;
}

export const CartItem: React.FC<CartItemProps> = ({ item, unitPrice, onRemove }) => {
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
        <Text style={styles.name}>
          {item.name}
          {item.variantName ? ` (${item.variantName})` : ''}
        </Text>
        <Text style={styles.price}>{formatCurrency(price)}</Text>
        {!!item.bundleComponentNames?.length && (
          <Text style={styles.includes} numberOfLines={1}>Includes: {item.bundleComponentNames.join(', ')}</Text>
        )}
        {discountAmount > 0 && (
          <Text style={styles.promo} numberOfLines={1}>
            {appliedPromotionLabel} applied · saved {formatCurrency(discountAmount)}
          </Text>
        )}
      </View>
      <View style={styles.controls}>
        <Text style={styles.quantity}>{quantityLabel}</Text>
        <Text style={styles.subtotal}>{formatCurrency(subtotal)}</Text>
        <AnimatedPressable
          onPress={onRemove}
          style={styles.removeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Remove ${item.name} from cart`}
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  info: { flex: 2 },
  name: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  price: { fontSize: Typography.size.small, color: Colors.textSecondary },
  includes: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
  promo: { fontSize: Typography.size.caption, color: Colors.success, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  quantity: { fontSize: Typography.size.body, color: Colors.textPrimary, minWidth: 40, textAlign: 'center' },
  subtotal: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.success, minWidth: 70, textAlign: 'right' },
  removeBtn: { padding: Spacing.xs },
});
