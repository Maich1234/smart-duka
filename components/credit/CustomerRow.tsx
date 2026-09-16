import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { CreditStatusPill } from './CreditStatusPill';
import { formatCurrency } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';
import type { Customer } from '@/services/customers';

interface CustomerRowProps {
  customer: Customer;
  currency?: string;
  onPress: () => void;
  /** Staggers the entrance; capped by the caller so a long list doesn't crawl in. */
  index?: number;
  isLast?: boolean;
}

/**
 * One customer in the directory.
 *
 * The amount owed is the only figure on the row, and only when there is one —
 * a row that says "KES 0.00" for every walk-in customer buries the three people
 * the owner is actually looking for. Everything else (limit, available credit,
 * history) waits for the account screen.
 *
 * Flat with a hairline, matching ListRow rather than wrapping each customer in
 * its own card: a directory is a list, and forty shadowed cards is a texture,
 * not a hierarchy.
 */
export const CustomerRow: React.FC<CustomerRowProps> = ({
  customer,
  currency,
  onPress,
  index = 0,
  isLast = false,
}) => {
  const account = customer.account;
  const owes = (account?.outstanding ?? 0) > 0;
  // Server-computed — never derived from the device clock during render.
  const daysLate = account?.status === 'overdue' ? account.daysOverdue : undefined;

  return (
    <Animated.View entering={FadeInDown.duration(Motion.duration.slow).delay(Math.min(index, 6) * 40)}>
      <AnimatedPressable
        onPress={onPress}
        style={[styles.row, !isLast && styles.divider]}
        pressScale={Motion.press.scaleCard}
        accessibilityRole="button"
        accessibilityLabel={
          owes
            ? `${customer.name}, owes ${formatCurrency(account!.outstanding, currency)}${
              account?.status === 'overdue' ? ', overdue' : ''}`
            : customer.name
        }
      >
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{customer.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {customer.phone || 'No phone number'}
          </Text>
        </View>

        {owes && account ? (
          <View style={styles.amountWrap}>
            <Text
              style={[styles.amount, account.status === 'overdue' && styles.amountOverdue]}
              numberOfLines={1}
            >
              {formatCurrency(account.outstanding, currency)}
            </Text>
            {account.status === 'overdue' && (
              <CreditStatusPill status="overdue" daysOverdue={daysLate} />
            )}
          </View>
        ) : account?.blocked ? (
          <CreditStatusPill status="none" label="Blocked" />
        ) : null}

        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} style={styles.chevron} />
      </AnimatedPressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    // 48dp minimum with the vertical padding above — thumb-sized on a cheap
    // phone held in one hand over a counter.
    minHeight: 60,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  info: { flex: 1 },
  name: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  amountWrap: { alignItems: 'flex-end', gap: 3 },
  amount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    // Tabular figures so a column of amounts lines up on the decimal instead
    // of jittering with each digit width.
    fontVariant: ['tabular-nums'],
    color: Colors.textPrimary,
  },
  amountOverdue: { color: Colors.danger },
  chevron: { marginLeft: 2 },
});
