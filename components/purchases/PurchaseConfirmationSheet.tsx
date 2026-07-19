import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

interface PurchaseConfirmationSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  supplierName: string;
  productCount: number;
  totalQuantity: number;
  grandTotal: number;
  staffName: string;
  date: Date;
}

const SummaryRow: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={styles.row}>
    <View style={styles.rowIconWrap}>
      <Ionicons name={icon} size={15} color={Colors.primary} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
  </View>
);

/**
 * Final review before the purchase is actually saved — the spec's explicit
 * "Confirmation Screen" step, kept as a sheet (not a new route) to stay fast.
 */
export const PurchaseConfirmationSheet: React.FC<PurchaseConfirmationSheetProps> = ({
  visible,
  onClose,
  onConfirm,
  loading = false,
  supplierName,
  productCount,
  totalQuantity,
  grandTotal,
  staffName,
  date,
}) => {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Confirm Purchase</Text>

      <View style={styles.card}>
        <SummaryRow icon="business-outline" label="Supplier" value={supplierName || 'Walk-in / no supplier'} />
        <SummaryRow icon="cube-outline" label="Products" value={`${productCount} product${productCount === 1 ? '' : 's'}`} />
        <SummaryRow icon="layers-outline" label="Total Quantity" value={String(totalQuantity)} />
        <SummaryRow icon="cash-outline" label="Total Cost" value={formatCurrency(grandTotal)} />
        <SummaryRow icon="trending-up-outline" label="Inventory Impact" value={`+${totalQuantity} unit${totalQuantity === 1 ? '' : 's'}`} />
        <SummaryRow icon="person-outline" label="Staff" value={staffName} />
        <SummaryRow icon="calendar-outline" label="Date" value={formatDateTime(date)} />
      </View>

      <View style={styles.buttonRow}>
        <Button title="Back to Edit" variant="outline" onPress={onClose} style={styles.flexBtn} />
        <Button title="Confirm & Save" onPress={onConfirm} loading={loading} style={styles.flexBtn} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.md, textAlign: 'center', color: Colors.textPrimary },
  card: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  rowIconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: Typography.size.small, fontFamily: Typography.fontFamily, color: Colors.textSecondary },
  rowValue: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, maxWidth: '55%' },
  buttonRow: { flexDirection: 'row', gap: Spacing.md },
  flexBtn: { flex: 1 },
});
