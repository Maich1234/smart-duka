import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { printHtml } from '@/utils/printReceipt';
import { buildReceiptHtml } from '@/utils/receiptHtml';
import { ReceiptPreview } from './ReceiptPreview';
import { Sale } from '@/services/sales';
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
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
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
      // Most rejections here are the user dismissing the system print sheet,
      // not a real failure — keep the receipt open so they can simply retry.
    } finally {
      setPrinting(false);
    }
  };

  if (!sale) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Sale Complete</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ReceiptPreview sale={sale} shopName={shopName} shopPhone={shopPhone} currency={currency} />
          </ScrollView>

          <TouchableOpacity
            style={[styles.printBtn, printing && styles.printBtnDisabled]}
            onPress={handlePrint}
            activeOpacity={0.85}
            disabled={printing}
          >
            {printing ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.printBtnText}>Print Receipt</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.skipBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
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
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  printBtnDisabled: {
    opacity: 0.7,
  },
  printBtnText: {
    color: Colors.white,
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: Typography.size.body,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipBtnText: {
    fontSize: Typography.size.body,
    color: Colors.textSecondary,
  },
});
