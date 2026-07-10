import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  thankYouNote?: string;
  logoUrl?: string;
  motto?: string;
  /** Show the "Void Sale" action (owner, or staff with 'void_sale'). */
  canVoid?: boolean;
  /** Called when the user confirms voiding. Parent owns the mutation. */
  onVoid?: (sale: Sale) => void;
  voiding?: boolean;
}

export const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({
  visible,
  onClose,
  sale,
  shopName,
  shopPhone,
  currency,
  thankYouNote,
  logoUrl,
  motto,
  canVoid = false,
  onVoid,
  voiding = false,
}) => {
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (!sale) return;
    setPrinting(true);
    try {
      const html = await buildReceiptHtml(sale, shopName, shopPhone, currency, undefined, thankYouNote, logoUrl, motto);
      await printHtml(html);
    } catch {
      // Likely the user dismissed the system print sheet — not a real failure.
    } finally {
      setPrinting(false);
    }
  };

  if (!sale) return null;

  const isVoided = sale.status === 'voided';

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Sale Details</Text>

        {isVoided && (
          <View style={styles.voidedBanner}>
            <Ionicons name="ban-outline" size={14} color="#B91C1C" />
            <Text style={styles.voidedBannerText}>
              This sale was voided{sale.voidReason ? ` — ${sale.voidReason}` : ''}. Stock was restored and it is excluded from totals.
            </Text>
          </View>
        )}

        <ReceiptPreview sale={sale} shopName={shopName} shopPhone={shopPhone} currency={currency} thankYouNote={thankYouNote} logoUrl={logoUrl} motto={motto} />

        <View style={styles.buttonRow}>
          <Button title="Close" variant="outline" onPress={onClose} style={styles.flexBtn} />
          <Button title="Print Receipt" onPress={handlePrint} loading={printing} style={styles.flexBtn} />
        </View>

        {canVoid && !isVoided && onVoid && (
          <Button
            title="Void Sale"
            variant="danger"
            loading={voiding}
            onPress={() => onVoid(sale)}
            style={styles.voidBtn}
          />
        )}
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
  voidBtn: { marginTop: Spacing.sm },
  voidedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  voidedBannerText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: '#B91C1C',
    lineHeight: 16,
  },
});
