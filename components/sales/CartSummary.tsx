import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';

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
  paymentMethod: 'cash' | 'mpesa';
  onPaymentMethodChange: (method: 'cash' | 'mpesa') => void;
  onCheckout: () => void;
  loading?: boolean;
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

export const CartSummary: React.FC<CartSummaryProps> = ({
  total,
  totalSavings = 0,
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
  const isMpesa = paymentMethod === 'mpesa';
  const mpesaReady = isMpesa && mpesaEnabled && isValidKenyanPhone(customerPhone);
  const manualReady = isMpesa && manualReceiptCode.trim().length >= 6;

  const handleDigitChange = (digits: string) => {
    const clean = digits.replace(/\D/g, '').slice(0, 9);
    onCustomerPhoneChange?.(clean ? `+254${clean}` : '');
  };

  const checkoutLabel = !isMpesa
    ? 'Complete Sale'
    : mpesaMode === 'manual'
      ? 'Record Sale'
      : 'Send Payment Request';

  const checkoutIcon = !isMpesa
    ? 'checkmark-circle-outline'
    : mpesaMode === 'manual'
      ? 'checkmark-circle-outline'
      : 'phone-portrait-outline';

  const checkoutDisabled =
    isMpesa &&
    (mpesaMode === 'stk'
      ? !mpesaEnabled || !mpesaReady
      : !manualReady);

  return (
    <View style={styles.container}>
      {totalSavings > 0 && (
        <Text style={styles.savings}>You saved {formatCurrency(totalSavings, currency)}</Text>
      )}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{formatCurrency(total, currency)}</Text>
      </View>

      {/* Payment method selector */}
      <View style={styles.paymentRow}>
        <Button
          title="Cash"
          variant={paymentMethod === 'cash' ? 'primary' : 'outline'}
          onPress={() => onPaymentMethodChange('cash')}
          size="sm"
          style={styles.paymentBtn}
          leftIcon={paymentMethod === 'cash' ? 'checkmark-circle' : undefined}
          accessibilityLabel="Pay with cash"
          accessibilityState={{ selected: paymentMethod === 'cash' }}
        />
        <Button
          title="M-Pesa"
          variant={paymentMethod === 'mpesa' ? 'primary' : 'outline'}
          onPress={() => onPaymentMethodChange('mpesa')}
          size="sm"
          style={styles.paymentBtn}
          leftIcon={paymentMethod === 'mpesa' ? 'checkmark-circle' : undefined}
          accessibilityLabel="Pay with M-Pesa"
          accessibilityState={{ selected: paymentMethod === 'mpesa' }}
        />
      </View>

      {isMpesa && (
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
              {!mpesaEnabled && (
                <View style={styles.mpesaWarning}>
                  <Text style={styles.mpesaWarningText}>
                    M-Pesa is not configured for this shop. Contact the owner to connect M-Pesa Business.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              {/* Manual receipt code */}
              <Text style={styles.phoneLabel}>M-Pesa Receipt Code</Text>
              <TextInput
                style={styles.receiptInput}
                value={manualReceiptCode}
                onChangeText={(text) => onManualReceiptCodeChange?.(text.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="e.g. QGJ7ABC123"
                placeholderTextColor={Colors.textTertiary}
                returnKeyType="done"
                maxLength={20}
              />
              {manualReceiptCode.length > 0 && manualReceiptCode.trim().length < 6 && (
                <Text style={styles.phoneError}>Enter a valid M-Pesa receipt code</Text>
              )}
              <View style={styles.alreadyPaidHint}>
                <Text style={styles.alreadyPaidHintText}>
                  Use this when the customer has already paid via M-Pesa directly. Enter the code from their M-Pesa confirmation SMS.
                </Text>
              </View>
            </>
          )}
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
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  paymentBtn: { flex: 1 },

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

  mpesaWarning: {
    backgroundColor: Colors.warningSubtle,
    borderRadius: 8,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  mpesaWarningText: {
    fontSize: 12,
    color: '#92400E',
    fontFamily: Typography.fontFamily,
    lineHeight: 16,
  },
});
