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
import type { PurchaseCartEntry } from '@/store/purchaseCartStore';

interface PurchaseCartItemProps {
  item: PurchaseCartEntry;
  onEdit: () => void;
  onRemove: () => void;
}

export const PurchaseCartItem: React.FC<PurchaseCartItemProps> = ({ item, onEdit, onRemove }) => {
  const isDecimalUnit = !!item.unitOfMeasure && item.unitOfMeasure !== 'unit' &&
    (item.productType === 'weighted' || item.productType === 'refillable');
  const quantityLabel = isDecimalUnit ? `${item.cartQuantity} ${item.unitOfMeasure}` : `x${item.cartQuantity}`;

  return (
    <Animated.View
      style={styles.container}
      entering={FadeIn.duration(Motion.duration.base)}
      exiting={FadeOut.duration(Motion.duration.fast)}
      layout={LinearTransition.duration(Motion.duration.slow)}
    >
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
          {item.cartVariantName ? ` (${item.cartVariantName})` : ''}
        </Text>
        <Text style={styles.calc}>
          {quantityLabel} × {formatCurrency(item.cartUnitCost)}
        </Text>
      </View>
      <View style={styles.controls}>
        <Text style={styles.subtotal}>{formatCurrency(item.cartTotalCost)}</Text>
        <AnimatedPressable
          onPress={onEdit}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Edit ${item.name}`}
          accessibilityRole="button"
        >
          <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={onRemove}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Remove ${item.name} from purchase`}
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
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
  info: { flex: 1, paddingRight: Spacing.sm },
  name: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  calc: { fontSize: Typography.size.small, color: Colors.textSecondary, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  subtotal: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, minWidth: 70, textAlign: 'right' },
  iconBtn: { padding: Spacing.xs },
});
