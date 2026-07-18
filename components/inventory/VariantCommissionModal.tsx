import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { haptics } from '@/utils/haptics';
import { formatCurrency } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export interface VariantCommissionValue {
  enabled: boolean;
  basePrice: string;
  employeeSharePercent: string;
}

interface VariantCommissionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (value: VariantCommissionValue) => void;
  variantName: string;
  sellingPrice: number;
  initialValue: VariantCommissionValue;
}

export const VariantCommissionModal: React.FC<VariantCommissionModalProps> = ({
  visible,
  onClose,
  onConfirm,
  variantName,
  sellingPrice,
  initialValue,
}) => {
  const [enabled, setEnabled] = useState(initialValue.enabled);
  const [basePrice, setBasePrice] = useState(initialValue.basePrice);
  const [employeeSharePercent, setEmployeeSharePercent] = useState(initialValue.employeeSharePercent);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setEnabled(initialValue.enabled);
      setBasePrice(initialValue.basePrice);
      setEmployeeSharePercent(initialValue.employeeSharePercent || '100');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const parsedBase = parseFloat(basePrice);
  const parsedShare = parseFloat(employeeSharePercent);
  const hasValidBase = !isNaN(parsedBase) && parsedBase >= 0;
  const hasValidShare = !isNaN(parsedShare) && parsedShare >= 0 && parsedShare <= 100;

  const excess = hasValidBase ? Math.max(0, sellingPrice - parsedBase) : 0;
  const employeeAmount = hasValidBase && hasValidShare ? Math.round(excess * (parsedShare / 100) * 100) / 100 : 0;
  const shopAmount = hasValidBase ? Math.round((sellingPrice - employeeAmount) * 100) / 100 : 0;

  const handleConfirm = () => {
    if (!enabled) {
      onConfirm({ enabled: false, basePrice: '', employeeSharePercent: '100' });
      return;
    }
    if (!hasValidBase) {
      setError('Enter a valid base price');
      return;
    }
    if (parsedBase > sellingPrice) {
      setError(`Base price cannot exceed the selling price (${formatCurrency(sellingPrice)})`);
      return;
    }
    if (!hasValidShare) {
      setError('Employee share must be between 0 and 100%');
      return;
    }
    setError('');
    onConfirm({ enabled: true, basePrice, employeeSharePercent });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Employee Commission</Text>
      <Text style={styles.variantName}>{variantName || 'Variant'}</Text>
      <Text style={styles.hint}>Selling price: {formatCurrency(sellingPrice)}</Text>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Enable commission for this variant</Text>
        <Switch
          value={enabled}
          onValueChange={(v) => { haptics.selection(); setEnabled(v); }}
          trackColor={{ false: Colors.border, true: Colors.primarySubtle }}
          thumbColor={enabled ? Colors.primary : undefined}
        />
      </View>

      {enabled && (
        <>
          <Input
            label="Shop's base price"
            value={basePrice}
            onChangeText={setBasePrice}
            keyboardType="numeric"
            placeholder="e.g. 400"
          />
          <Input
            label="Employee's share of the excess (%)"
            value={employeeSharePercent}
            onChangeText={setEmployeeSharePercent}
            keyboardType="numeric"
            placeholder="100"
          />
          {hasValidBase && hasValidShare && (
            <Text style={styles.preview}>
              At {formatCurrency(sellingPrice)}, employee earns {formatCurrency(employeeAmount)}, shop keeps {formatCurrency(shopAmount)}.
            </Text>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
        </>
      )}

      <View style={styles.buttonRow}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flexBtn} />
        <Button title="Save" onPress={handleConfirm} style={styles.flexBtn} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.sm, color: Colors.textPrimary, textAlign: 'center' },
  variantName: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, textAlign: 'center', marginBottom: Spacing.xs },
  hint: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  toggleLabel: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  preview: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  error: {
    fontSize: Typography.size.caption,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
});
