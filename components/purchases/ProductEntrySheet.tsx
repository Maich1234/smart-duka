import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAlert } from '@/context/AlertContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { usePurchaseLineCalc } from '@/hooks/usePurchaseLineCalc';
import { formatCurrency } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import type { Product } from '@/services/products';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ProductEntryLine {
  quantity: number;
  unitCost: number;
  totalCost: number;
  variantId?: string;
  variantName?: string;
}

interface ProductEntrySheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (line: ProductEntryLine) => void;
  product: Product | null;
  loading?: boolean;
  /** Pre-fills the sheet when editing an already-added line. */
  initial?: { quantity: number; unitCost: number; totalCost: number; variantId?: string } | null;
}

/**
 * The core of the New Purchase flow — quantity/unit cost/total cost with
 * live two-way auto-calc (see usePurchaseLineCalc). Whichever of unit
 * cost/total cost was typed last drives the other; quantity always
 * recomputes whichever one isn't the active anchor.
 */
export const ProductEntrySheet: React.FC<ProductEntrySheetProps> = ({
  visible,
  onClose,
  onConfirm,
  product,
  loading = false,
  initial,
}) => {
  const { toast } = useAlert();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const calc = usePurchaseLineCalc();

  useEffect(() => {
    if (!visible) return;
    calc.reset(initial ?? undefined);
    if (product?.productType === 'configurable') {
      setSelectedVariantId(initial?.variantId ?? product.variants?.[0]?._id ?? null);
    } else {
      setSelectedVariantId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, product?._id]);

  if (!product) return null;

  const isConfigurable = product.productType === 'configurable';
  const isDecimalType = product.productType === 'weighted' || product.productType === 'refillable';
  const unitLabel = isDecimalType ? product.unitOfMeasure : 'unit';

  const selectedVariant = isConfigurable ? product.variants?.find((v) => v._id === selectedVariantId) : undefined;
  const referenceCost = isConfigurable ? selectedVariant?.costPrice : product.costPrice;
  const referenceStock = isConfigurable ? selectedVariant?.quantity : product.quantity;

  const lowCostWarning =
    referenceCost != null && referenceCost > 0 && !isNaN(calc.parsedUnitCost) && calc.parsedUnitCost > 0 &&
    calc.parsedUnitCost < referenceCost * 0.5;
  const highCostWarning =
    referenceCost != null && referenceCost > 0 && !isNaN(calc.parsedUnitCost) &&
    calc.parsedUnitCost > referenceCost * 1.5;

  const helperText = (() => {
    if (calc.anchor === 'totalCost') {
      if (!calc.totalCost || !calc.quantity) return null;
      return `${calc.totalCost} ÷ ${calc.quantity} = ${!isNaN(calc.parsedUnitCost) ? round2(calc.parsedUnitCost) : '?'}`;
    }
    if (!calc.quantity || !calc.unitCost) return null;
    return `${calc.quantity} × ${calc.unitCost} = ${!isNaN(calc.parsedTotalCost) ? round2(calc.parsedTotalCost) : '?'}`;
  })();

  const handleConfirm = () => {
    if (isConfigurable && !selectedVariantId) {
      toast({ type: 'warning', message: `Select an option for ${product.name}` });
      return;
    }
    const rawQty = calc.parsedQuantity;
    const qty = isDecimalType ? rawQty : Math.trunc(rawQty);
    if (isNaN(qty) || qty <= 0) {
      toast({ type: 'error', message: 'Quantity must be greater than 0' });
      return;
    }
    if (isNaN(calc.parsedUnitCost) || calc.parsedUnitCost < 0) {
      toast({ type: 'error', message: 'Enter a valid unit cost' });
      return;
    }
    onConfirm({
      quantity: qty,
      unitCost: round2(calc.parsedUnitCost),
      // Recomputed fresh from the final quantity/unitCost so a truncated
      // fractional quantity never leaves totalCost slightly out of sync.
      totalCost: round2(qty * calc.parsedUnitCost),
      variantId: selectedVariant?._id,
      variantName: selectedVariant?.name,
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{initial ? 'Edit Product' : 'Add Product'}</Text>
      <Text style={styles.productName}>{product.name}</Text>

      {isConfigurable && (
        <View style={styles.chipRow}>
          {(product.variants ?? []).map((v) => {
            const active = v._id === selectedVariantId;
            return (
              <AnimatedPressable
                key={v._id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedVariantId(v._id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{v.name}</Text>
                <Text style={[styles.chipSub, active && styles.chipTextActive]}>
                  In stock: {v.quantity}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      )}

      {(referenceCost != null || referenceStock != null) && (
        <View style={styles.referenceRow}>
          {referenceStock != null && (
            <Text style={styles.referenceText}>Current stock: {referenceStock} {unitLabel}</Text>
          )}
          {referenceCost != null && referenceCost > 0 && (
            <Text style={styles.referenceText}>Current avg cost: {formatCurrency(referenceCost)}</Text>
          )}
        </View>
      )}

      <View style={styles.fieldRow}>
        <Input
          label={isDecimalType ? `Quantity (${unitLabel})` : 'Quantity'}
          value={calc.quantity}
          onChangeText={calc.setQuantity}
          keyboardType={isDecimalType ? 'decimal-pad' : 'numeric'}
          placeholder={isDecimalType ? 'e.g. 0.5' : 'e.g. 10'}
          style={styles.flexField}
        />
      </View>
      <View style={styles.fieldRow}>
        <Input
          label="Unit Cost"
          value={calc.unitCost}
          onChangeText={calc.setUnitCost}
          keyboardType="decimal-pad"
          placeholder="0.00"
          style={styles.flexField}
        />
        <Input
          label="Total Cost"
          value={calc.totalCost}
          onChangeText={calc.setTotalCost}
          keyboardType="decimal-pad"
          placeholder="0.00"
          style={styles.flexField}
        />
      </View>

      {helperText && (
        <View style={styles.calcRow}>
          <Ionicons name="calculator-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.calcText}>{helperText}</Text>
        </View>
      )}

      {(lowCostWarning || highCostWarning) && (
        <View style={styles.warningBanner}>
          <Ionicons name="alert-circle-outline" size={15} color="#B45309" />
          <Text style={styles.warningText}>
            {lowCostWarning
              ? 'This unit cost looks unusually low compared to the current average cost.'
              : 'This unit cost is significantly higher than the current average cost.'}
          </Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flexBtn} />
        <Button title={initial ? 'Update' : 'Add'} onPress={handleConfirm} loading={loading} style={styles.flexBtn} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.xs, textAlign: 'center', color: Colors.textPrimary },
  productName: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, textAlign: 'center', marginBottom: Spacing.md, color: Colors.textSecondary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, minWidth: 100 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  chipSub: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
  chipTextActive: { color: Colors.white },

  referenceRow: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 2,
  },
  referenceText: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamily, color: Colors.textSecondary },

  fieldRow: { flexDirection: 'row', gap: Spacing.sm },
  flexField: { flex: 1 },

  calcRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -Spacing.sm, marginBottom: Spacing.md },
  calcText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamily, color: Colors.textSecondary },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.warningSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  warningText: { flex: 1, fontSize: Typography.size.caption, fontFamily: Typography.fontFamily, color: '#92400E', lineHeight: 16 },

  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  flexBtn: { flex: 1 },
});
