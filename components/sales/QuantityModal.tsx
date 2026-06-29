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
import type { UnitOfMeasure } from '@/services/products';

interface QuantityModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (quantity: number, unitPrice?: number) => void;
  productName: string;
  maxStock: number;
  loading?: boolean;
  /** When set to a real unit (kg/g/l/ml), allows decimal quantities and labels the field accordingly */
  unitOfMeasure?: UnitOfMeasure;
  /** When true, shows an editable price field alongside quantity */
  priceEditable?: boolean;
  defaultPrice?: number;
  minPrice?: number;
  maxPrice?: number;
}

export const QuantityModal: React.FC<QuantityModalProps> = ({
  visible,
  onClose,
  onConfirm,
  productName,
  maxStock,
  loading = false,
  unitOfMeasure = 'unit',
  priceEditable = false,
  defaultPrice,
  minPrice,
  maxPrice,
}) => {
  const isDecimal = unitOfMeasure !== 'unit';
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState(defaultPrice != null ? String(defaultPrice) : '');
  const { toast } = useAlert();

  React.useEffect(() => {
    if (visible) {
      setQuantity(isDecimal ? '' : '1');
      setPrice(defaultPrice != null ? String(defaultPrice) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleConfirm = () => {
    const qty = isDecimal ? parseFloat(quantity) : parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0 || qty > maxStock) {
      toast({ type: 'error', message: `Quantity must be greater than 0${maxStock < Infinity ? ` and at most ${maxStock}` : ''}` });
      return;
    }

    let unitPrice: number | undefined;
    if (priceEditable) {
      unitPrice = parseFloat(price);
      if (isNaN(unitPrice) || unitPrice <= 0) {
        toast({ type: 'error', message: 'Enter a valid price greater than 0' });
        return;
      }
      if (minPrice != null && unitPrice < minPrice) {
        toast({ type: 'error', message: `Price cannot be below ${minPrice}` });
        return;
      }
      if (maxPrice != null && unitPrice > maxPrice) {
        toast({ type: 'error', message: `Price cannot exceed ${maxPrice}` });
        return;
      }
    }

    onConfirm(qty, unitPrice);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Add to Cart</Text>
      <Text style={styles.productName}>{productName}</Text>
      {maxStock < Infinity && <Text style={styles.maxStock}>Available: {maxStock}</Text>}
      <Input
        label={isDecimal ? `Quantity (${unitOfMeasure})` : 'Quantity'}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType={isDecimal ? 'decimal-pad' : 'numeric'}
        placeholder={isDecimal ? `e.g. 0.5` : undefined}
      />
      {priceEditable && (
        <>
          <Input
            label={`Price${minPrice != null || maxPrice != null ? ` (${minPrice ?? 0}–${maxPrice ?? '∞'})` : ''}`}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
          <HelpLink slug="recording-sales" label="Why can I change this price?" />
        </>
      )}
      <View style={styles.buttonRow}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flexBtn} />
        <Button title="Add" onPress={handleConfirm} loading={loading} style={styles.flexBtn} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.sm, textAlign: 'center', color: Colors.textPrimary },
  productName: { fontSize: Typography.size.body, textAlign: 'center', marginBottom: Spacing.xs },
  maxStock: { fontSize: Typography.size.small, textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.md },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
});
