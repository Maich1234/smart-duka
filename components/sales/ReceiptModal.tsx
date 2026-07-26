import React, { useState } from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { ReceiptPreview } from './ReceiptPreview';
import { Sale } from '@/services/sales';
import { useAlert } from '@/context/AlertContext';
import { usePrinterStore } from '@/store/printerStore';
import { printSale, type PrintTarget } from '@/utils/printSale';
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
  const [printing, setPrinting] = useState<PrintTarget | null>(null);
  const { toast } = useAlert();
  const printer = usePrinterStore((s) => s.printer);

  const handlePrint = async (target: PrintTarget) => {
    if (!sale) return;
    setPrinting(target);
    try {
      const outcome = await printSale(
        sale,
        { shopName, shopPhone, currency, servedByName, thankYouNote, logoUrl, motto },
        target
      );
      // Only worth a toast when the receipt did not come out where it was aimed.
      if (outcome.fallbackReason) {
        toast({ type: 'warning', message: `${outcome.fallbackReason} Using the system printer instead.` });
      }
    } catch {
      // Most rejections here are the user dismissing the system print sheet,
      // not a real failure — keep the receipt open so they can simply retry.
    } finally {
      setPrinting(null);
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

      <Button
        title={printer ? `Print to ${printer.name}` : 'Print Receipt'}
        leftIcon={printer ? 'print' : undefined}
        onPress={() => handlePrint('bluetooth')}
        loading={printing === 'bluetooth'}
        style={styles.printBtn}
      />
      {/* Escape hatch once a Bluetooth printer is saved: PDF, sharing, or a
          different printer entirely without unpairing the counter's one. */}
      {printer && (
        <Button
          title="System printer / PDF"
          variant="ghost"
          onPress={() => handlePrint('system')}
          loading={printing === 'system'}
          style={styles.printBtn}
        />
      )}
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
