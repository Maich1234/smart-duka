import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface StockUpdateModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  currentStock: number;
  productName: string;
  loading?: boolean;
}

type Mode = 'add' | 'set';

export const StockUpdateModal: React.FC<StockUpdateModalProps> = ({
  visible,
  onClose,
  onConfirm,
  currentStock,
  productName,
  loading = false,
}) => {
  // "Add" is the common case (restocking a delivery) so it's the default —
  // typing "500" here adds 500 units instead of requiring the owner to
  // compute currentStock + 500 themselves.
  const [mode, setMode] = useState<Mode>('add');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (visible) {
      setMode('add');
      setAmount('');
    }
  }, [visible, currentStock]);

  const parsedAmount = parseInt(amount, 10);
  const resultingStock =
    !isNaN(parsedAmount) && parsedAmount >= 0
      ? mode === 'add'
        ? currentStock + parsedAmount
        : parsedAmount
      : null;

  const handleConfirm = () => {
    if (resultingStock !== null) onConfirm(resultingStock);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Update Stock</Text>
      <Text style={styles.productName}>{productName}</Text>
      <Text style={styles.currentStock}>Current stock: {currentStock}</Text>

      <View style={styles.modeRow}>
        <AnimatedPressable
          style={[styles.modeBtn, mode === 'add' && styles.modeBtnActive]}
          onPress={() => { haptics.selection(); setMode('add'); }}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'add' }}
          accessibilityLabel="Add to current stock"
        >
          <Text style={[styles.modeBtnText, mode === 'add' && styles.modeBtnTextActive]}>Add Stock</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.modeBtn, mode === 'set' && styles.modeBtnActive]}
          onPress={() => { haptics.selection(); setMode('set'); }}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'set' }}
          accessibilityLabel="Set stock to an exact total"
        >
          <Text style={[styles.modeBtnText, mode === 'set' && styles.modeBtnTextActive]}>Set Total</Text>
        </AnimatedPressable>
      </View>

      <Input
        label={mode === 'add' ? 'Quantity to Add' : 'New Total Quantity'}
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder={mode === 'add' ? 'e.g. 500' : String(currentStock)}
        autoFocus
      />
      <Text style={styles.resultHint}>
        {resultingStock !== null
          ? `New stock will be ${resultingStock}`
          : mode === 'add'
            ? 'This adds to the current stock — the low stock alert works the same way.'
            : 'This sets the total, replacing the current stock.'}
      </Text>

      <View style={styles.buttonRow}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flexBtn} />
        <Button title="Update" onPress={handleConfirm} loading={loading} disabled={resultingStock === null} style={styles.flexBtn} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.sm, color: Colors.textPrimary, textAlign: 'center' },
  productName: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, textAlign: 'center', marginBottom: Spacing.xs },
  currentStock: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  modeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  modeBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  modeBtnText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  modeBtnTextActive: {
    color: Colors.primary,
  },
  resultHint: {
    fontSize: Typography.size.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
});