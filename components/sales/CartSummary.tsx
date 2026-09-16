import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { BorderRadius } from '@/constants/BorderRadius';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';
import {
  CREDIT_METHOD_KEY,
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
  /** Items in the sale — shown beside the total as the way into the lines. */
  itemCount?: number;
  /** What the cashier earns on this sale, when the shop shows commission. */
  totalCommission?: number;
  /** Opens the line-item review. Makes the total row a control. */
  onReview?: () => void;
  /** The customer chosen for a credit sale, if any — required to check out on credit. */
  creditCustomerName?: string | null;
  /** Opens the customer picker/creator sheet. */
  onPickCreditCustomer?: () => void;
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
  itemCount = 0,
  totalCommission = 0,
  onReview,
  creditCustomerName = null,
  onPickCreditCustomer,
}) => {
  const isMpesa = paymentMethod === MPESA_METHOD_KEY;
  const isCredit = paymentMethod === CREDIT_METHOD_KEY;
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

  const checkoutLabel = stkSelected
    ? 'Send Payment Request'
    : isCredit
      ? 'Review Credit Sale'
      : 'Complete Sale';
  const checkoutIcon = stkSelected
    ? 'phone-portrait-outline'
    : isCredit
      ? 'time-outline'
      : 'checkmark-circle-outline';
  // STK needs a number to push to; credit needs a named customer before there
  // is anyone to owe the debt. Every other combination records and prints.
  const checkoutDisabled = (stkSelected && !mpesaReady) || (isCredit && !creditCustomerName);

  return (
    <View style={styles.container}>
      {(totalSavings > 0 || totalCommission > 0) && (
        <View style={styles.notesRow}>
          {totalCommission > 0 && (
            // The cashier's own earnings on this sale. It belongs on the till,
            // not a tap away behind the line items: it is the reason a
            // commission scheme changes anything about how someone sells.
            <Text style={styles.commission}>
              You earn {formatCurrency(totalCommission, currency)}
            </Text>
          )}
          <View style={styles.notesSpacer} />
          {totalSavings > 0 && (
            <Text style={styles.savings}>Saved {formatCurrency(totalSavings, currency)}</Text>
          )}
        </View>
      )}
      {/* The total doubles as the way into the lines. They are only ever
          read to correct something, so they cost a tap rather than permanent
          height on every sale. */}
      <AnimatedPressable
        onPress={onReview}
        disabled={!onReview}
        style={styles.totalRow}
        pressScale={0.995}
        accessibilityRole={onReview ? 'button' : 'summary'}
        accessibilityLabel={`${itemCount} item${itemCount === 1 ? '' : 's'}, total ${formatCurrency(total, currency)}`}
        accessibilityHint={onReview ? 'Shows the items in this sale' : undefined}
      >
        <Text style={styles.totalLabel}>
          {itemCount} item{itemCount === 1 ? '' : 's'}
        </Text>
        {!!onReview && (
          <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} style={styles.totalChevron} />
        )}
        <View style={styles.totalSpacer} />
        <Text style={styles.totalAmount}>{formatCurrency(total, currency)}</Text>
      </AnimatedPressable>

      {/* The shop's own buttons, in its own order. Selection is carried by
          fill, border and a tick together rather than fill alone: at arm's
          length over a counter, one filled button among outlines is easy to
          read the wrong way round. */}
      <View style={styles.paymentRow} accessibilityRole="radiogroup">
        {methods.map((method) => {
          const selected = paymentMethod === method.key;
          return (
            <AnimatedPressable
              key={method.key}
              onPress={() => onPaymentMethodChange(method.key)}
              style={[styles.method, selected && styles.methodSelected]}
              pressScale={0.985}
              // "button" + selected, never "radio": RNGH-backed pressables do
              // not fire on web under input-like roles.
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Pay with ${method.label}`}
            >
              <Ionicons
                name={selected ? 'checkmark-circle' : (methodIcon(method) as never)}
                size={18}
                color={selected ? Colors.white : Colors.textSecondary}
              />
              <Text
                style={[styles.methodLabel, selected && styles.methodLabelSelected]}
                numberOfLines={1}
              >
                {method.label}
              </Text>
            </AnimatedPressable>
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
                  accessibilityLabel="Customer phone number"
                  accessibilityHint="Nine digits after +254"
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

      {/* Credit requires a named customer before anything else — there is no
          such thing as an anonymous debt. Tapping opens the picker/creator
          sheet; the actual limit/balance check happens in the confirmation
          sheet PosScreen shows next, never here. */}
      {isCredit && (
        <Animated.View entering={FadeInDown.duration(220).springify()} exiting={FadeOut.duration(150)}>
          <Text style={styles.phoneLabel}>Customer</Text>
          <AnimatedPressable
            onPress={onPickCreditCustomer}
            style={styles.creditCustomerRow}
            pressScale={0.99}
            accessibilityRole="button"
            accessibilityLabel={creditCustomerName ? `Customer: ${creditCustomerName}. Tap to change.` : 'Choose a customer'}
          >
            <Ionicons
              name={creditCustomerName ? 'person-circle' : 'person-add-outline'}
              size={18}
              color={creditCustomerName ? Colors.primary : Colors.textTertiary}
            />
            <Text
              style={[styles.creditCustomerText, !creditCustomerName && styles.creditCustomerPlaceholder]}
              numberOfLines={1}
            >
              {creditCustomerName || 'Choose or add a customer'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </AnimatedPressable>
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

      {/* size lg, full width, and the only filled teal below the payment
          row — the end of every visit to this screen. */}
      <Button
        title={checkoutLabel}
        leftIcon={checkoutIcon}
        onPress={onCheckout}
        loading={loading}
        disabled={checkoutDisabled}
        // Greyed says "not now" to anyone who can see it and nothing at all to
        // anyone who can't. This is the one control on the screen that is ever
        // withheld, so it should be able to say what it is waiting for.
        accessibilityHint={checkoutDisabled ? "Enter the customer's phone number first" : undefined}
        size="lg"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // A control's floor, not a label's: this row is the way into the lines,
    // and the cashiers this is built for include older hands with less steady
    // aim than a design review has.
    minHeight: 44,
  },
  totalSpacer: { flex: 1 },
  totalChevron: { marginLeft: 2 },
  totalLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  totalAmount: {
    // Prominent, not a hero number: the cashier confirms it, they don't
    // admire it, and every point it gains is a point the catalogue loses.
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  notesRow: { flexDirection: 'row', alignItems: 'center' },
  notesSpacer: { flex: 1 },
  savings: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.success,
  },
  commission: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.success,
  },
  paymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  method: {
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  methodSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  methodLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  methodLabelSelected: { color: Colors.white },

  // Sub-mode selector
  subModeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
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
  creditCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    height: 46,
  },
  creditCustomerText: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  creditCustomerPlaceholder: {
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },
  alreadyPaidHintText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    lineHeight: 17,
  },

});
