import React, { useState } from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { ReceiptPreview } from './ReceiptPreview';
import { Sale } from '@/services/sales';
import { printHtml } from '@/utils/printReceipt';
import { buildReceiptHtml } from '@/utils/receiptHtml';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface ReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  sale: Sale | null;
  shopName: string;
  shopPhone?: string;
  currency?: string;
  servedByName?: string;
  thankYouNote?: string;
  logoUrl?: string;
  motto?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  visible,
  onClose,
  sale,
  shopName,
  shopPhone,
  currency,
  servedByName,
  thankYouNote,
  logoUrl,
  motto,
}) => {
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (!sale) return;
    setPrinting(true);
    try {
      const html = await buildReceiptHtml(sale, shopName, shopPhone, currency, servedByName, thankYouNote, logoUrl, motto);
      await printHtml(html);
    } catch {
      // Most rejections here are the user dismissing the system print sheet,
      // not a real failure — keep the receipt open so they can simply retry.
    } finally {
      setPrinting(false);
    }
  };

  if (!sale) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.heading}>Sale Complete</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ReceiptPreview
          sale={sale}
          shopName={shopName}
          shopPhone={shopPhone}
          currency={currency}
          servedByName={servedByName}
          thankYouNote={thankYouNote}
          logoUrl={logoUrl}
          motto={motto}
        />
      </ScrollView>

      <Button title="Print Receipt" onPress={handlePrint} loading={printing} style={styles.printBtn} />
      <Button title="Done" variant="outline" onPress={onClose} />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  heading: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.success,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  scroll: {
    marginBottom: Spacing.md,
  },
  scrollContent: {
    alignItems: 'center',
  },
  printBtn: {
    marginBottom: Spacing.sm,
  },
});
