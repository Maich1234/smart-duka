import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';
import type { CreditTransaction, CreditTransactionType } from '@/services/customers';

/**
 * How each kind of ledger entry presents itself.
 *
 * The sign is the whole story of a timeline — did this add to what they owe or
 * take it away — so it is carried by the amount's prefix and its colour
 * together, never colour alone.
 */
const PRESENTATION: Record<CreditTransactionType, {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  sign: '+' | '−';
  tint: string;
}> = {
  CREDIT_SALE: { title: 'Bought on credit', icon: 'cart-outline', sign: '+', tint: Colors.textPrimary },
  CREDIT_OPENING_BALANCE: { title: 'Brought forward', icon: 'archive-outline', sign: '+', tint: Colors.textPrimary },
  CREDIT_PAYMENT: { title: 'Paid', icon: 'arrow-down-circle-outline', sign: '−', tint: Colors.success },
  // Corrections read as corrections, not as ordinary movements.
  CREDIT_SALE_REVERSAL: { title: 'Debt cancelled', icon: 'return-up-back-outline', sign: '−', tint: Colors.textSecondary },
  CREDIT_PAYMENT_REVERSAL: { title: 'Payment reversed', icon: 'return-up-back-outline', sign: '+', tint: Colors.danger },
};

interface CreditTransactionRowProps {
  transaction: CreditTransaction;
  currency?: string;
  /** Opens the correction sheet. Owner only — omit it and the row is inert. */
  onPress?: () => void;
  isLast?: boolean;
}

export const CreditTransactionRow: React.FC<CreditTransactionRowProps> = ({
  transaction,
  currency,
  onPress,
  isLast = false,
}) => {
  const p = PRESENTATION[transaction.type] ?? PRESENTATION.CREDIT_SALE;
  const isReversed = transaction.status === 'reversed' || !!transaction.reversedBy;
  const isDebt = transaction.type === 'CREDIT_SALE' || transaction.type === 'CREDIT_OPENING_BALANCE';
  const partlyPaid = isDebt
    && transaction.status === 'outstanding'
    && (transaction.outstanding ?? 0) < transaction.amount;

  // One line of context under the title, chosen by what actually explains this
  // entry — a reference number for a payment, a due date for a debt, the reason
  // for a correction. Never all three.
  const detail = (() => {
    if (isReversed) return transaction.reason || 'Reversed';
    if (transaction.type === 'CREDIT_PAYMENT') {
      return [transaction.paymentMethodLabel, transaction.reference].filter(Boolean).join(' · ')
        || transaction.paymentMethodLabel
        || '';
    }
    if (isDebt && transaction.dueAt) {
      const overdue = new Date(transaction.dueAt) < new Date() && (transaction.outstanding ?? 0) > 0;
      const base = `Due ${formatDate(transaction.dueAt)}`;
      if (partlyPaid) {
        return `${base} · ${formatCurrency(transaction.outstanding ?? 0, currency)} left`;
      }
      return overdue ? `${base} · overdue` : base;
    }
    return transaction.reason || '';
  })();

  const content = (
    <View style={[styles.row, !isLast && styles.divider]}>
      <View style={styles.iconWrap}>
        <Ionicons
          name={p.icon}
          size={17}
          color={isReversed ? Colors.textTertiary : p.tint}
        />
      </View>

      <View style={styles.info}>
        <Text style={[styles.title, isReversed && styles.struck]} numberOfLines={1}>
          {p.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[formatDate(transaction.createdAt), transaction.staffName, detail]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      <View style={styles.amountWrap}>
        <Text
          style={[styles.amount, { color: isReversed ? Colors.textTertiary : p.tint }, isReversed && styles.struck]}
          numberOfLines={1}
        >
          {p.sign}{formatCurrency(transaction.amount, currency)}
        </Text>
        <Text style={styles.balance} numberOfLines={1}>
          {formatCurrency(transaction.balanceAfter, currency)}
        </Text>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <AnimatedPressable
      onPress={onPress}
      pressScale={Motion.press.scaleCard}
      accessibilityRole="button"
      accessibilityLabel={`${p.title}, ${formatCurrency(transaction.amount, currency)}, ${formatDate(transaction.createdAt)}`}
      accessibilityHint="Opens correction options"
    >
      {content}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: Spacing.lg,
    minHeight: 56,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  iconWrap: { width: 22, alignItems: 'center' },
  info: { flex: 1 },
  title: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  amountWrap: { alignItems: 'flex-end' },
  amount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    fontVariant: ['tabular-nums'],
  },
  // The running balance after this entry — smaller and quieter than the
  // movement itself, but present, because "what did they owe after this" is
  // the question a timeline is read to answer.
  balance: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  struck: { textDecorationLine: 'line-through' },
});
