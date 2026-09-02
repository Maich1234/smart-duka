import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAlert } from '@/context/AlertContext';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { HelpLink } from '../help/HelpLink';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatQuantity as fmtQty } from '@/utils/formatters';
import type { UnitOfMeasure } from '@/services/products';

interface QuantityModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (quantity: number, unitPrice?: number) => void;
  productName: string;
  maxStock: number;
  /**
   * Units of this product already sitting in the cart. Stock is checked against
   * what's *left* after them — otherwise adding 5 of a 5-stock item twice builds
   * a cart the server can only reject at checkout, with the whole sale typed in.
   */
  inCart?: number;
  loading?: boolean;
  /** When set to a real unit (kg/g/l/ml), allows decimal quantities and labels the field accordingly */
  unitOfMeasure?: UnitOfMeasure;
  /** When true, shows an editable price field alongside quantity */
  priceEditable?: boolean;
  defaultPrice?: number;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * The body is mounted only while the sheet is open, so its useState defaults
 * *are* the per-open reset. That replaces an effect that re-set every field on
 * `visible` — which rendered the previous sale's quantity for one frame before
 * correcting itself, and is the cascading render set-state-in-effect flags.
 */
export const QuantityModal: React.FC<QuantityModalProps> = ({ visible, onClose, ...rest }) => (
  <BottomSheet visible={visible} onClose={onClose}>
    {visible && <QuantityModalBody onClose={onClose} {...rest} />}
  </BottomSheet>
);

const QuantityModalBody: React.FC<Omit<QuantityModalProps, 'visible'>> = ({
  onClose,
  onConfirm,
  productName,
  maxStock,
  inCart = 0,
  loading = false,
  unitOfMeasure = 'unit',
  priceEditable = false,
  defaultPrice,
  minPrice,
  maxPrice,
}) => {
  const isDecimal = unitOfMeasure !== 'unit';
  const [quantity, setQuantity] = useState(isDecimal ? '' : '1');
  const [price, setPrice] = useState(defaultPrice != null ? String(defaultPrice) : '');
  const { toast } = useAlert();

  // Untracked stock is Infinity, and Infinity - n stays Infinity, so the
  // untracked case needs no special-casing below.
  const available = Math.max(0, maxStock - inCart);
  // Android's decimal-pad emits the locale separator, so a comma has to mean
  // the same as a dot — otherwise "0,5" parses to 0 and reads as an error.
  const qty = isDecimal ? parseFloat(quantity.replace(',', '.')) : parseInt(quantity, 10);
  const unitPrice = priceEditable ? parseFloat(price.replace(',', '.')) : undefined;

  // Live feedback under the field, rather than a toast the cashier only sees
  // after tapping Add: at a busy counter the correction should arrive while
  // they're still looking at the number they typed.
  const quantityError = (() => {
    if (!quantity.trim()) return undefined;
    // parseInt('1.5') silently becomes 1 — say so instead of quietly selling
    // a different quantity than the one on screen.
    if (!isDecimal && /[.,]/.test(quantity)) return 'Sold in whole units, enter a whole number.';
    if (isNaN(qty)) return 'Enter a number.';
    if (qty <= 0) return 'Quantity must be more than 0.';
    if (qty > available) {
      const left = `${fmtQty(available)}${isDecimal ? ` ${unitOfMeasure}` : ''}`;
      return inCart > 0
        ? `Only ${left} left, ${fmtQty(inCart)} already in this sale.`
        : `Only ${left} in stock.`;
    }
    return undefined;
  })();

  const priceError = (() => {
    if (!priceEditable || !price.trim() || unitPrice == null) return undefined;
    if (isNaN(unitPrice) || unitPrice <= 0) return 'Enter a price above 0.';
    // Bare numbers, matching the range already printed in the field's label.
    if (minPrice != null && unitPrice < minPrice) return `Cannot go below ${minPrice}.`;
    if (maxPrice != null && unitPrice > maxPrice) return `Cannot go above ${maxPrice}.`;
    return undefined;
  })();

  const canAdd =
    !quantityError && !isNaN(qty) && qty > 0 && (!priceEditable || (!priceError && !!price.trim()));

  const handleConfirm = () => {
    // The button is disabled while invalid; this stays as the backstop.
    if (!canAdd) {
      toast({ type: 'error', message: quantityError ?? priceError ?? 'Enter a quantity first' });
      return;
    }
    onConfirm(qty, unitPrice);
  };

  return (
    <>
      <Text style={styles.title}>Add to Cart</Text>
      <Text style={styles.productName}>{productName}</Text>
      {maxStock < Infinity && (
        <Text style={styles.maxStock}>
          Available: {fmtQty(available)}
          {isDecimal ? ` ${unitOfMeasure}` : ''}
          {inCart > 0 ? ` · ${fmtQty(inCart)} already in this sale` : ''}
        </Text>
      )}
      <Input
        label={isDecimal ? `Quantity (${unitOfMeasure})` : 'Quantity'}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType={isDecimal ? 'decimal-pad' : 'numeric'}
        placeholder={isDecimal ? `e.g. 0.5` : undefined}
        error={quantityError}
      />
      {priceEditable && (
        <>
          <Input
            label={`Price${minPrice != null || maxPrice != null ? ` (${minPrice ?? 0}–${maxPrice ?? '∞'})` : ''}`}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            error={priceError}
          />
          <HelpLink slug="recording-sales" label="Why can I change this price?" />
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
  productName: { fontSize: Typography.size.body, textAlign: 'center', marginBottom: Spacing.xs },
  maxStock: { fontSize: Typography.size.small, textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.md },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
});
