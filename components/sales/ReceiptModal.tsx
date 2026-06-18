import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { printHtml } from '@/utils/printReceipt';
import { Sale } from '@/services/sales';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

interface ReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  sale: Sale | null;
  shopName: string;
}

function buildHtml(sale: Sale, shopName: string): string {
  const rows = sale.items
    .map(
      (item) => `
      <tr>
        <td style="padding:4px 0;font-size:12px">${item.productName}</td>
        <td style="text-align:center;padding:4px 6px;font-size:12px">x${item.quantity}</td>
        <td style="text-align:right;font-size:12px">${formatCurrency(item.unitPrice)}</td>
        <td style="text-align:right;padding-left:8px;font-size:12px;font-weight:600">${formatCurrency(item.subtotal)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<body style="font-family:'Courier New',monospace;max-width:320px;margin:0 auto;padding:24px 16px">
  <h2 style="text-align:center;margin:0 0 2px;font-size:18px">${shopName}</h2>
  <p style="text-align:center;margin:0 0 12px;font-size:10px;color:#888">Smart Duka POS</p>
  <hr style="border:none;border-top:1px dashed #aaa;margin:10px 0">
  <table style="width:100%;font-size:11px;margin-bottom:6px">
    <tr><td><b>Invoice</b></td><td style="text-align:right">${sale.invoiceNumber}</td></tr>
    <tr><td><b>Date</b></td><td style="text-align:right">${formatDateTime(sale.createdAt)}</td></tr>
    <tr><td><b>Cashier</b></td><td style="text-align:right">${sale.staff?.name ?? '-'}</td></tr>
    <tr><td><b>Payment</b></td><td style="text-align:right">${sale.paymentMethod.toUpperCase()}</td></tr>
  </table>
  <hr style="border:none;border-top:1px dashed #aaa;margin:10px 0">
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="border-bottom:1px solid #000;font-size:11px">
        <th style="text-align:left;padding-bottom:4px">Item</th>
        <th style="text-align:center;padding-bottom:4px">Qty</th>
        <th style="text-align:right;padding-bottom:4px">Unit</th>
        <th style="text-align:right;padding-bottom:4px;padding-left:8px">Sub</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <hr style="border:none;border-top:1px dashed #aaa;margin:10px 0">
  <table style="width:100%;font-size:15px;font-weight:bold">
    <tr>
      <td>TOTAL</td>
      <td style="text-align:right">${formatCurrency(sale.totalAmount)}</td>
    </tr>
  </table>
  <p style="text-align:center;margin-top:24px;font-size:10px;color:#888">Thank you for your business!</p>
</body>
</html>`;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  visible,
  onClose,
  sale,
  shopName,
}) => {
  const handlePrint = useCallback(async () => {
    if (!sale) return;
    try {
      await printHtml(buildHtml(sale, shopName));
    } catch {
      Alert.alert('Print cancelled');
    }
    onClose();
  }, [sale, shopName, onClose]);

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
            <View style={styles.receipt}>
              {/* Header */}
              <Text style={styles.shopName}>{shopName}</Text>
              <Text style={styles.poweredBy}>Smart Duka POS</Text>

              <Text style={styles.dash}>- - - - - - - - - - - - - - - - - - -</Text>

              {/* Meta */}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Invoice</Text>
                <Text style={styles.metaValue}>{sale.invoiceNumber}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date</Text>
                <Text style={styles.metaValue}>{formatDateTime(sale.createdAt)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Cashier</Text>
                <Text style={styles.metaValue}>{sale.staff?.name ?? '-'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Payment</Text>
                <View style={[styles.badge, sale.paymentMethod === 'mpesa' ? styles.badgeMpesa : styles.badgeCash]}>
                  <Text style={styles.badgeText}>{sale.paymentMethod.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.dash}>- - - - - - - - - - - - - - - - - - -</Text>

              {/* Column headers */}
              <View style={styles.colHeader}>
                <Text style={[styles.colText, { flex: 3 }]}>Item</Text>
                <Text style={[styles.colText, styles.center, { width: 36 }]}>Qty</Text>
                <Text style={[styles.colText, styles.right, { width: 90 }]}>Subtotal</Text>
              </View>

              {/* Line items */}
              {sale.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={[styles.itemName, { flex: 3 }]} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text style={[styles.itemMeta, styles.center, { width: 36 }]}>
                    x{item.quantity}
                  </Text>
                  <Text style={[styles.itemMeta, styles.right, { width: 90 }]}>
                    {formatCurrency(item.subtotal)}
                  </Text>
                </View>
              ))}

              <Text style={styles.dash}>- - - - - - - - - - - - - - - - - - -</Text>

              {/* Total */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TOTAL</Text>
                <Text style={styles.totalAmount}>{formatCurrency(sale.totalAmount)}</Text>
              </View>

              <Text style={styles.dash}>- - - - - - - - - - - - - - - - - - -</Text>
              <Text style={styles.thanks}>Thank you for your business!</Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <TouchableOpacity style={styles.printBtn} onPress={handlePrint} activeOpacity={0.85}>
            <Text style={styles.printBtnText}>Print Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.skipBtnText}>Skip</Text>
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

  // Receipt paper
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
  shopName: {
    fontFamily: Typography.fontFamilyBold,
    fontSize: Typography.size.h3,
    color: Colors.textPrimary,
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

  // Meta rows
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

  // Item columns
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
  center: {
    textAlign: 'center',
  },
  right: {
    textAlign: 'right',
  },

  // Total
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
    fontSize: Typography.size.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  // Buttons
  printBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: Spacing.sm,
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
