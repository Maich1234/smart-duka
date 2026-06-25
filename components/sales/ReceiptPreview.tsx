import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Sale } from '@/services/sales';
import { HelpLink } from '@/components/help/HelpLink';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { PUBLIC_WEB_URL } from '@/constants/config';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

interface ReceiptPreviewProps {
  sale: Sale;
  shopName: string;
  shopPhone?: string;
  currency?: string;
  /** Fallback "Served By" name when sale.staff isn't populated (e.g. right after checkout) */
  servedByName?: string;
  /** Owner-configurable closing message; falls back to the default thank-you line */
  thankYouNote?: string;
  logoUrl?: string;
  motto?: string;
}

const DASH = '- - - - - - - - - - - - - - - - - - -';

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  sale,
  shopName,
  shopPhone,
  currency,
  servedByName,
  thankYouNote,
  logoUrl,
  motto,
}) => {
  return (
    <View style={styles.receipt}>
      {!!logoUrl && (
        <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
      )}
      <Text style={styles.shopName}>{shopName}</Text>
      {!!motto && <Text style={styles.motto}>{motto}</Text>}
      {!!shopPhone && <Text style={styles.shopPhone}>{shopPhone}</Text>}
      <Text style={styles.poweredBy}>Smart Duka POS</Text>

      <Text style={styles.dash}>{DASH}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Invoice</Text>
        <Text style={styles.metaValue}>{sale.invoiceNumber}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Date</Text>
        <Text style={styles.metaValue}>{formatDateTime(sale.createdAt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Served By</Text>
        <Text style={styles.metaValue}>{sale.staff?.name ?? servedByName ?? '-'}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Payment</Text>
        <View style={[styles.badge, sale.paymentMethod === 'mpesa' ? styles.badgeMpesa : styles.badgeCash]}>
          <Text style={styles.badgeText}>{sale.paymentMethod.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.dash}>{DASH}</Text>

      <View style={styles.colHeader}>
        <Text style={[styles.colText, { flex: 3 }]}>Item</Text>
        <Text style={[styles.colText, styles.center, { width: 36 }]}>Qty</Text>
        <Text style={[styles.colText, styles.right, { width: 90 }]}>Subtotal</Text>
      </View>

      {sale.items.map((item, index) => (
        <View key={index} style={styles.itemRow}>
          <View style={{ flex: 3 }}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.productName}
            </Text>
            {!!item.discountAmount && item.discountAmount > 0 && (
              <Text style={styles.promoLabel} numberOfLines={1}>{item.appliedPromotionLabel}</Text>
            )}
          </View>
          <Text style={[styles.itemMeta, styles.center, { width: 36 }]}>x{item.quantity}</Text>
          <Text style={[styles.itemMeta, styles.right, { width: 90 }]}>{formatCurrency(item.subtotal, currency)}</Text>
        </View>
      ))}

      <Text style={styles.dash}>{DASH}</Text>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.totalAmount}>{formatCurrency(sale.totalAmount, currency)}</Text>
      </View>

      <Text style={styles.dash}>{DASH}</Text>
      <Text style={styles.thanks}>{thankYouNote?.trim() || 'Thank you, dear customer!'}</Text>

      {!!sale.receiptToken && (
        <View style={styles.qrSection}>
          <QRCode value={`${PUBLIC_WEB_URL}/r/${sale.receiptToken}`} size={120} />
          <Text style={styles.qrHint}>Scan to verify this receipt & rate your service</Text>
          <HelpLink slug="receipts-and-ratings" label="How does this work?" style={styles.qrHelpLink} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  receipt: {
    backgroundColor: Colors.surface,
    width: '100%',
    borderRadius: 12,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  logo: {
    width: 72,
    height: 72,
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  shopName: {
    fontFamily: Typography.fontFamilyBold,
    fontSize: Typography.size.h3,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  motto: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 2,
  },
  shopPhone: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  poweredBy: {
    fontSize: Typography.size.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  dash: {
    color: Colors.textTertiary,
    textAlign: 'center',
    fontSize: Typography.size.caption,
    marginVertical: Spacing.sm,
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  metaLabel: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
  },
  metaValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeCash: {
    backgroundColor: '#DCFCE7',
  },
  badgeMpesa: {
    backgroundColor: '#DBEAFE',
  },
  badgeText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  colHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 4,
    marginBottom: 4,
  },
  colText: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamilySemiBold,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemName: {
    fontSize: Typography.size.small,
    color: Colors.textPrimary,
  },
  itemMeta: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
  },
  promoLabel: {
    fontSize: Typography.size.caption,
    color: Colors.success,
  },
  center: {
    textAlign: 'center',
  },
  right: {
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  totalAmount: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.success,
  },
  thanks: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    fontStyle: 'italic',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  qrSection: {
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  qrHint: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 180,
  },
  qrHelpLink: {
    marginTop: Spacing.xs,
  },
});
