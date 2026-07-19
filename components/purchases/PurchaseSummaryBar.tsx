import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { formatCurrency } from '@/utils/formatters';

interface PurchaseSummaryBarProps {
  productsTotal: number;
  additionalCostsTotal: number;
  grandTotal: number;
  totalQuantity: number;
  onReview: () => void;
  loading?: boolean;
}

/**
 * Live-updating purchase summary — Products Total / Additional Costs /
 * Grand Total / estimated inventory increase — shown above the "Review &
 * Save" action, mirroring CartSummary's role on the Sales screen.
 */
export const PurchaseSummaryBar: React.FC<PurchaseSummaryBarProps> = ({
  productsTotal,
  additionalCostsTotal,
  grandTotal,
  totalQuantity,
  onReview,
  loading = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Products Total</Text>
        <Text style={styles.value}>{formatCurrency(productsTotal)}</Text>
      </View>
      {additionalCostsTotal > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>Additional Costs</Text>
          <Text style={styles.value}>{formatCurrency(additionalCostsTotal)}</Text>
        </View>
      )}
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.grandLabel}>Grand Purchase Cost</Text>
        <Text style={styles.grandValue}>{formatCurrency(grandTotal)}</Text>
      </View>
      <Text style={styles.inventoryNote}>
        Estimated inventory increase: +{totalQuantity} unit{totalQuantity === 1 ? '' : 's'}
      </Text>

      <Button title="Review & Save Purchase" leftIcon="checkmark-circle-outline" onPress={onReview} loading={loading} style={styles.reviewBtn} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  label: { fontSize: Typography.size.small, fontFamily: Typography.fontFamily, color: Colors.textSecondary },
  value: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.sm },
  grandLabel: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  grandValue: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  inventoryNote: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamily, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.md },
  reviewBtn: { marginTop: Spacing.xs },
});
