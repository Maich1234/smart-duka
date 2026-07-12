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
  /** Show the "Refund" action (owner, or staff with 'refund_own_sales'/'refund_all_sales'). */
  canRefund?: boolean;
  /** Called when the user taps Refund. Parent owns the confirm + mutation. */
  onRefund?: (sale: Sale) => void;
  refunding?: boolean;
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
  canRefund = false,
  onRefund,
  refunding = false,
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
  const isRefunded = sale.status === 'refunded';
  const isRefundPending = sale.status === 'refund_pending';
  const isSettled = isVoided || isRefunded || isRefundPending;

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

        {isRefunded && (
          <View style={styles.refundedBanner}>
            <Ionicons name="checkmark-circle-outline" size={14} color="#15803D" />
            <Text style={styles.refundedBannerText}>
              Refunded {sale.refund?.method === 'mpesa' ? 'via M-Pesa' : 'in cash'}
              {sale.refund?.reason ? ` — ${sale.refund.reason}` : ''}. Stock was restored and it is excluded from totals.
            </Text>
          </View>
        )}

        {isRefundPending && (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={14} color="#B45309" />
            <Text style={styles.pendingBannerText}>
              M-Pesa is returning the money to the customer. Stock is restored once the refund completes.
            </Text>
          </View>
        )}

        {!isSettled && sale.refund?.failureReason && (
          <View style={styles.voidedBanner}>
            <Ionicons name="alert-circle-outline" size={14} color="#B91C1C" />
            <Text style={styles.voidedBannerText}>
              Last refund attempt failed: {sale.refund.failureReason}
            </Text>
          </View>
        )}

        <ReceiptPreview sale={sale} shopName={shopName} shopPhone={shopPhone} currency={currency} thankYouNote={thankYouNote} logoUrl={logoUrl} motto={motto} />

        <View style={styles.buttonRow}>
          <Button title="Close" variant="outline" onPress={onClose} style={styles.flexBtn} />
          <Button title="Print Receipt" onPress={handlePrint} loading={printing} style={styles.flexBtn} />
        </View>

        {canRefund && !isSettled && onRefund && (
          <Button
            title={sale.paymentMethod === 'mpesa' ? 'Refund Customer (M-Pesa)' : 'Refund Customer'}
            variant="outline"
            loading={refunding}
            onPress={() => onRefund(sale)}
            style={styles.voidBtn}
          />
        )}

        {canVoid && !isSettled && onVoid && (
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
  refundedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  refundedBannerText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: '#15803D',
    lineHeight: 16,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pendingBannerText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: '#B45309',
    lineHeight: 16,
  },
});
