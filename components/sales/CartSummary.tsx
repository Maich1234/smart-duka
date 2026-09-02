import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';
import {
  MPESA_METHOD_KEY,
  methodIcon,
  type ShopPaymentMethod,
} from '@/constants/paymentMethods';

// Strip the +254 prefix so only the 9-digit suffix is shown in the input.
// The full E.164 value (+254XXXXXXXXX) is stored in the parent state.
function digitsOnly(phone: string): string {
  return phone.replace(/^\+254/, '');
}

// Validates that the full phone string is a valid Kenyan number.
export function isValidKenyanPhone(phone: string): boolean {
  return /^\+254[17]\d{8}$/.test(phone);
}

interface CartSummaryProps {
  total: number;
  totalSavings?: number;
  /** The shop's enabled buttons, already ordered. */
  methods: ShopPaymentMethod[];
  paymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
  onCheckout: () => void;
  loading?: boolean;
  /** True only when the shop has connected M-Pesa Business — enables STK Push. */
  mpesaEnabled?: boolean;
  customerPhone?: string;
  onCustomerPhoneChange?: (phone: string) => void;
  currency?: string;
  // M-Pesa sub-mode: initiate STK push, or record a receipt the customer already has
  mpesaMode?: 'stk' | 'manual';
  onMpesaModeChange?: (mode: 'stk' | 'manual') => void;
  manualReceiptCode?: string;
  onManualReceiptCodeChange?: (code: string) => void;
}

/**
 * The M-Pesa receipt code from the customer's confirmation SMS.
 *
 * Required in the "Already Paid" flow of a connected shop (it's the only proof
 * the sale has), optional everywhere else — an unconfigured shop must be able
 * to sell in one tap, so nothing here may block checkout.
 */
const ManualMpesaCode: React.FC<{
  value: string;
  onChange?: (code: string) => void;
  hint: string;
  optional?: boolean;
}> = ({ value, onChange, hint, optional = false }) => (
  <>
    <Text style={styles.phoneLabel}>
      {optional ? 'M-Pesa Code (optional)' : 'M-Pesa Receipt Code'}
    </Text>
    <TextInput
      style={styles.receiptInput}
      value={value}
      onChangeText={(text) => onChange?.(text.toUpperCase())}
      autoCapitalize="characters"
      autoCorrect={false}
      placeholder="e.g. QGJ7ABC123"
      placeholderTextColor={Colors.textTertiary}
      returnKeyType="done"
      maxLength={20}
      accessibilityLabel="M-Pesa receipt code"
    />
    {!optional && value.length > 0 && value.trim().length < 6 && (
      <Text style={styles.phoneError}>Enter a valid M-Pesa receipt code</Text>
    )}
    <View style={styles.alreadyPaidHint}>
      <Text style={styles.alreadyPaidHintText}>{hint}</Text>
    </View>
  </>
);

export const CartSummary: React.FC<CartSummaryProps> = ({
  total,
  totalSavings = 0,
  methods,
  paymentMethod,
  onPaymentMethodChange,
  onCheckout,
  loading = false,
  mpesaEnabled = false,
  customerPhone = '',
  onCustomerPhoneChange,
  currency,
  mpesaMode = 'stk',
  onMpesaModeChange,
  manualReceiptCode = '',
  onManualReceiptCodeChange,
}) => {
  const isMpesa = paymentMethod === MPESA_METHOD_KEY;
  // STK Push is only on the table with Daraja credentials saved. Without them
  // M-Pesa is an ordinary button: the customer paid on a Pochi, a till or a
  // personal number, and the cashier is recording that.
  const stkAvailable = isMpesa && mpesaEnabled;
  const stkSelected = stkAvailable && mpesaMode === 'stk';
  const mpesaReady = stkSelected && isValidKenyanPhone(customerPhone);

  const handleDigitChange = (digits: string) => {
    const clean = digits.replace(/\D/g, '').slice(0, 9);
    onCustomerPhoneChange?.(clean ? `+254${clean}` : '');
  };

  const checkoutLabel = stkSelected ? 'Send Payment Request' : 'Complete Sale';
  const checkoutIcon = stkSelected ? 'phone-portrait-outline' : 'checkmark-circle-outline';
  // Only the STK path can block checkout, and only because it needs a number to
  // push to. Every other combination records the sale and prints, like cash.
  const checkoutDisabled = stkSelected && !mpesaReady;

  return (
    <View style={styles.container}>
      {totalSavings > 0 && (
        <Text style={styles.savings}>You saved {formatCurrency(totalSavings, currency)}</Text>
      )}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{formatCurrency(total, currency)}</Text>
      </View>

      {/* Payment method selector — the shop's own buttons, in its own order */}
      <View style={styles.paymentRow}>
        {methods.map((method) => {
          const selected = paymentMethod === method.key;
          return (
            <Button
              key={method.key}
              title={method.label}
              variant={selected ? 'primary' : 'outline'}
              onPress={() => onPaymentMethodChange(method.key)}
              size="sm"
              style={styles.paymentBtn}
              leftIcon={selected ? 'checkmark-circle' : (methodIcon(method) as any)}
              accessibilityLabel={`Pay with ${method.label}`}
              accessibilityState={{ selected }}
            />
          );
        })}
      </View>

      {stkAvailable && (
        <Animated.View entering={FadeInDown.duration(220).springify()} exiting={FadeOut.duration(150)}>
          {/* Sub-mode: STK Push vs Already Paid */}
          <View style={styles.subModeRow}>
            <Button
              title="STK Push"
              variant={mpesaMode === 'stk' ? 'primary' : 'ghost'}
              onPress={() => onMpesaModeChange?.('stk')}
              size="sm"
              style={styles.subModeBtn}
              leftIcon={mpesaMode === 'stk' ? 'phone-portrait-outline' : undefined}
            />
            <Button
              title="Already Paid"
              variant={mpesaMode === 'manual' ? 'primary' : 'ghost'}
              onPress={() => onMpesaModeChange?.('manual')}
              size="sm"
              style={styles.subModeBtn}
              leftIcon={mpesaMode === 'manual' ? 'checkmark-done-outline' : undefined}
            />
          </View>

          {mpesaMode === 'stk' ? (
            <>
              {/* Phone number field — locked +254 prefix */}
              <Text style={styles.phoneLabel}>Customer Phone Number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.prefixBadge}>
                  <Text style={styles.prefixText}>🇰🇪 +254</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={digitsOnly(customerPhone)}
                  onChangeText={handleDigitChange}
                  keyboardType="number-pad"
                  maxLength={9}
                  placeholder="7XXXXXXXX"
                  placeholderTextColor={Colors.textTertiary}
                  returnKeyType="done"
                />
              </View>
              {customerPhone.length > 0 && !isValidKenyanPhone(customerPhone) && (
                <Text style={styles.phoneError}>Enter a valid number starting with 7 or 1 (9 digits)</Text>
              )}
            </>
          ) : (
            <ManualMpesaCode
              value={manualReceiptCode}
              onChange={onManualReceiptCodeChange}
              hint="Use this when the customer has already paid via M-Pesa directly. Enter the code from their M-Pesa confirmation SMS."
            />
          )}
        </Animated.View>
      )}

      {/* M-Pesa without Daraja credentials — a Pochi, a personal number, or a
          till nobody has connected yet. The sale completes on one tap; the
          receipt code is there for whoever reconciles later, never required. */}
      {isMpesa && !mpesaEnabled && (
        <Animated.View entering={FadeInDown.duration(220).springify()} exiting={FadeOut.duration(150)}>
          <ManualMpesaCode
            value={manualReceiptCode}
            onChange={onManualReceiptCodeChange}
            optional
            hint="Optional: helps you match this sale to your M-Pesa statement later."
          />
        </Animated.View>
      )}

      <Button
        title={checkoutLabel}
        leftIcon={checkoutIcon}
        onPress={onCheckout}
        loading={loading}
        disabled={checkoutDisabled}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  totalLabel: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  totalAmount: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  savings: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.success,
    textAlign: 'right',
    marginBottom: Spacing.xs,
  },
  paymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  // Two buttons split the row as before; a shop with more gets a tidy wrap
  // instead of six slivers.
  paymentBtn: { flexGrow: 1, flexBasis: '30%' },

  // Sub-mode selector
  subModeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
  },
  subModeBtn: { flex: 1 },

  // Phone input
  phoneLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  prefixBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  prefixText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  phoneError: {
    fontSize: 11,
    color: Colors.danger,
    fontFamily: Typography.fontFamily,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },

  // Manual receipt input
  receiptInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  alreadyPaidHint: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  alreadyPaidHintText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    lineHeight: 17,
  },

});
