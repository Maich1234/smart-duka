import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { ReceiptPreview } from './ReceiptPreview';
import { Sale } from '@/services/sales';
import { printHtml } from '@/utils/printReceipt';
import { buildReceiptHtml } from '@/utils/receiptHtml';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface SaleDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  sale: Sale | null;
  shopName: string;
  shopPhone?: string;
  currency?: string;
}

export const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({
  visible,
  onClose,
  sale,
  shopName,
  shopPhone,
  currency,
}) => {
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (!sale) return;
    setPrinting(true);
    try {
      await printHtml(buildReceiptHtml(sale, shopName, shopPhone, currency));
    } catch {
      // Likely the user dismissed the system print sheet — not a real failure.
    } finally {
      setPrinting(false);
    }
  };

  if (!sale) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Sale Details</Text>
        <ReceiptPreview sale={sale} shopName={shopName} shopPhone={shopPhone} currency={currency} />

        <View style={styles.buttonRow}>
          <Button title="Close" variant="outline" onPress={onClose} style={styles.flexBtn} />
          <Button title="Print Receipt" onPress={handlePrint} loading={printing} style={styles.flexBtn} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    marginBottom: Spacing.md,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  flexBtn: { flex: 1 },
});
