import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useAlert } from '@/context/AlertContext';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { formatCurrency } from '@/utils/formatters';
import type { ProductVariant } from '@/services/products';

interface VariantPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (variant: ProductVariant, quantity: number) => void;
  productName: string;
  variants: ProductVariant[];
  /**
   * Units of each variant already in the cart, keyed by variant id. Stock is
   * checked against what's left after them, so two trips through this sheet
   * can't build a cart the server has to reject at checkout.
   */
  inCartByVariant?: Record<string, number>;
  loading?: boolean;
}

/**
 * The body mounts only while open, so its useState defaults *are* the per-open
 * reset — replacing an effect that re-picked the default variant on `visible`
 * and rendered the previous product's selection for one frame first.
 */
export const VariantPickerModal: React.FC<VariantPickerModalProps> = ({ visible, onClose, ...rest }) => (
  <BottomSheet visible={visible} onClose={onClose}>
    {visible && <VariantPickerModalBody onClose={onClose} {...rest} />}
  </BottomSheet>
);

const VariantPickerModalBody: React.FC<Omit<VariantPickerModalProps, 'visible'>> = ({
  onClose,
  onConfirm,
  productName,
  variants,
  inCartByVariant,
  loading = false,
}) => {
  const remaining = (v: ProductVariant) =>
    Math.max(0, v.quantity - (inCartByVariant?.[v._id] ?? 0));

  // First variant with stock left, else the first one at all.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => variants.find((v) => remaining(v) > 0)?._id ?? variants[0]?._id ?? null,
  );
  const [quantity, setQuantity] = useState('1');
  const { toast } = useAlert();

  const selected = variants.find((v) => v._id === selectedId);
  const available = selected ? remaining(selected) : 0;
  const inCart = selected ? inCartByVariant?.[selected._id] ?? 0 : 0;
  const qty = parseInt(quantity, 10);

  // Shown under the field as it's typed, not as a toast after tapping Add.
  const quantityError = (() => {
    if (!quantity.trim()) return undefined;
    if (/[.,]/.test(quantity)) return 'Sold in whole units — enter a whole number.';
    if (isNaN(qty)) return 'Enter a number.';
    if (qty <= 0) return 'Quantity must be more than 0.';
    if (qty > available) {
      return inCart > 0
        ? `Only ${available} left — ${inCart} already in this sale.`
        : `Only ${available} in stock.`;
    }
    return undefined;
  })();

  const canAdd = !!selected && !quantityError && !isNaN(qty) && qty > 0;

  const handleConfirm = () => {
    if (!selected) {
      toast({ type: 'warning', message: 'Please choose a variant before adding to cart' });
      return;
    }
    // The button is disabled while invalid; this stays as the backstop.
    if (!canAdd) {
      toast({ type: 'error', message: quantityError ?? 'Enter a quantity first' });
      return;
    }
    onConfirm(selected, qty);
  };

  return (
    <>
      <Text style={styles.title}>Choose an Option</Text>
      <Text style={styles.productName}>{productName}</Text>

      <View style={styles.chipRow}>
        {variants.map((v) => {
          const active = v._id === selectedId;
          const outOfStock = remaining(v) === 0;
          return (
            <AnimatedPressable
              key={v._id}
              style={[styles.chip, active && styles.chipActive, outOfStock && styles.chipDisabled]}
              onPress={() => !outOfStock && setSelectedId(v._id)}
              disabled={outOfStock}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{v.name}</Text>
              <Text style={[styles.chipPrice, active && styles.chipTextActive]}>
                {formatCurrency(v.sellingPrice)}{outOfStock ? ' · Out of stock' : ''}
              </Text>
              {v.commissionPreview != null && (
                <Text style={[styles.chipCommission, active && styles.chipTextActive]}>
                  Earn {formatCurrency(v.commissionPreview)}
                </Text>
              )}
            </AnimatedPressable>
          );
        })}
      </View>

      {selected && (
        <>
          <Text style={styles.maxStock}>
            Available: {available}
            {inCart > 0 ? ` · ${inCart} already in this sale` : ''}
          </Text>
          <Input
            label="Quantity"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            error={quantityError}
          />
        </>
      )}

      <View style={styles.buttonRow}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flexBtn} />
        <Button
          title="Add"
          onPress={handleConfirm}
          loading={loading}
          disabled={!canAdd}
          style={styles.flexBtn}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.sm, textAlign: 'center', color: Colors.textPrimary },
  productName: { fontSize: Typography.size.body, textAlign: 'center', marginBottom: Spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, minWidth: 100 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  chipPrice: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
  chipCommission: { fontSize: Typography.size.caption, color: Colors.success, marginTop: 2, fontFamily: Typography.fontFamilySemiBold },
  chipTextActive: { color: Colors.white },
  maxStock: { fontSize: Typography.size.small, textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.sm },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
});
