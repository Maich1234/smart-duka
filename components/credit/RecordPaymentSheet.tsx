import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { formatCurrency } from '@/utils/formatters';
import {
  CREDIT_METHOD_KEY,
  methodIcon,
  resolveSaleMethods,
  type ShopPaymentMethod,
} from '@/constants/paymentMethods';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';

interface RecordPaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (data: { amount: number; paymentMethod: string; reference?: string }) => void;
  customerName: string;
  outstanding: number;
  /** The shop's own money-in buttons; credit is filtered out here. */
  shopMethods?: ShopPaymentMethod[] | null;
  currency?: string;
  loading?: boolean;
}

/**
 * Taking money against a debt.
 *
 * The balance is the first thing on the sheet, and "Pay all" is one tap,
 * because clearing the debt is what most repayments are — asking someone to
 * type a figure they can already see is friction with a rounding error
 * attached. Partial amounts stay fully supported: a duka takes what it's given.
 *
 * Every figure the confirmation shows is checked again on the server before a
 * shilling moves; this sheet's arithmetic is for the person holding the phone.
 */
export const RecordPaymentSheet: React.FC<RecordPaymentSheetProps> = ({
  visible,
  onClose,
  onConfirm,
  customerName,
  outstanding,
  shopMethods,
  currency,
  loading = false,
}) => {
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<string>('');
  const [reference, setReference] = useState('');

  // A debt cannot be repaid with credit — that would clear a balance with no
  // money arriving. The backend refuses it too; this stops the button existing.
  const methods = useMemo(
    () => resolveSaleMethods(shopMethods).filter((m) => m.key !== CREDIT_METHOD_KEY),
    [shopMethods],
  );
  const selected = method || methods[0]?.key || 'cash';
  const needsReference = selected === 'mpesa';

  const amount = Number.parseFloat(amountText.replace(/,/g, ''));
  const valid = Number.isFinite(amount) && amount > 0 && amount <= outstanding + 0.005;
  const remaining = valid ? Math.max(0, outstanding - amount) : outstanding;
  const tooMuch = Number.isFinite(amount) && amount > outstanding + 0.005;

  const reset = () => {
    setAmountText('');
    setMethod('');
    setReference('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleConfirm = () => {
    if (!valid) return;
    onConfirm({
      amount,
      paymentMethod: selected,
      reference: reference.trim() || undefined,
    });
    reset();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      maxHeightPercent={85}
      footer={
        <View style={styles.footer}>
          <Button title="Cancel" variant="ghost" onPress={handleClose} style={styles.flex1} />
          <Button
            title="Record Payment"
            leftIcon="checkmark-circle-outline"
            onPress={handleConfirm}
            disabled={!valid || loading}
            loading={loading}
            style={styles.flex2}
            accessibilityHint={
              valid ? undefined : tooMuch ? 'The amount is more than the balance' : 'Enter an amount first'
            }
          />
        </View>
      }
    >
      <View style={styles.body}>
        <Text style={styles.heading}>Record payment</Text>
        <Text style={styles.customer} numberOfLines={1}>{customerName}</Text>

        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Owes</Text>
          <Text style={styles.balanceValue}>{formatCurrency(outstanding, currency)}</Text>
        </View>

        {/* The amount field. Large, numeric, and pre-loadable in one tap. */}
        <View>
          <View style={styles.amountRow}>
            <Text style={styles.currencyPrefix}>{currency || 'KES'}</Text>
            <TextInput
              style={styles.amountInput}
              value={amountText}
              onChangeText={(t) => setAmountText(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="done"
              accessibilityLabel="Payment amount"
            />
            <AnimatedPressable
              onPress={() => setAmountText(String(outstanding))}
              style={styles.payAll}
              accessibilityRole="button"
              accessibilityLabel={`Pay the full balance, ${formatCurrency(outstanding, currency)}`}
            >
              <Text style={styles.payAllText}>Pay all</Text>
            </AnimatedPressable>
          </View>
          {tooMuch && (
            <Animated.Text entering={FadeIn.duration(Motion.duration.fast)} style={styles.error}>
              That&rsquo;s more than {customerName} owes. The balance is{' '}
              {formatCurrency(outstanding, currency)}.
            </Animated.Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Paid with</Text>
          <View style={styles.methodRow} accessibilityRole="radiogroup">
            {methods.map((m) => {
              const isSelected = selected === m.key;
              return (
                <AnimatedPressable
                  key={m.key}
                  onPress={() => setMethod(m.key)}
                  style={[styles.method, isSelected && styles.methodSelected]}
                  pressScale={0.985}
                  // "button" + selected, never "radio": RNGH-backed pressables
                  // do not fire under input-like roles on web.
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Paid with ${m.label}`}
                >
                  <Ionicons
                    name={(isSelected ? 'checkmark-circle' : methodIcon(m)) as never}
                    size={16}
                    color={isSelected ? Colors.white : Colors.textSecondary}
                  />
                  <Text
                    style={[styles.methodLabel, isSelected && styles.methodLabelSelected]}
                    numberOfLines={1}
                  >
                    {m.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {needsReference ? 'M-Pesa code' : 'Reference'}{' '}
            <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.referenceInput}
            value={reference}
            onChangeText={(t) => setReference(needsReference ? t.toUpperCase() : t)}
            autoCapitalize={needsReference ? 'characters' : 'none'}
            autoCorrect={false}
            maxLength={60}
            placeholder={needsReference ? 'e.g. QGJ7ABC123' : 'Anything you want to remember'}
            placeholderTextColor={Colors.textTertiary}
            accessibilityLabel={needsReference ? 'M-Pesa code' : 'Payment reference'}
          />
        </View>

        {/* The consequence, stated before it happens — the same contract the
            credit summary makes before a debt is created. */}
        {valid && (
          <Animated.View entering={FadeIn.duration(Motion.duration.base)} style={styles.resultBlock}>
            <Text style={styles.resultLabel}>
              {remaining <= 0.005 ? 'Balance after' : 'Still owing after'}
            </Text>
            <Text style={[styles.resultValue, remaining <= 0.005 && styles.resultValueClear]}>
              {remaining <= 0.005 ? 'Paid up' : formatCurrency(remaining, currency)}
            </Text>
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
  heading: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  customer: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginTop: -Spacing.sm,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  balanceLabel: { flex: 1, fontSize: Typography.size.small, color: Colors.textSecondary },
  balanceValue: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    height: 56,
  },
  currencyPrefix: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  amountInput: {
    flex: 1,
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  payAll: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primarySubtle,
    // 44dp effective target with the row height around it.
    minHeight: 32,
    justifyContent: 'center',
  },
  payAllText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  error: {
    fontSize: Typography.size.caption,
    color: Colors.danger,
    marginTop: 6,
    lineHeight: 17,
  },
  section: { gap: 6 },
  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  optional: { fontFamily: Typography.fontFamily, color: Colors.textTertiary },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    minHeight: 44,
  },
  methodSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  methodLabel: { fontSize: Typography.size.small, color: Colors.textSecondary },
  methodLabelSelected: { color: Colors.white, fontFamily: Typography.fontFamilySemiBold },
  referenceInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    height: 46,
    fontSize: Typography.size.body,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily,
  },
  resultBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
  },
  resultLabel: { flex: 1, fontSize: Typography.size.small, color: Colors.textSecondary },
  resultValue: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  resultValueClear: { color: Colors.success },
  footer: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
});
