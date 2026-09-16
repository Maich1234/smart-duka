import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import type { CreditAccount } from '@/services/customers';

interface CreditSummarySheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  customerName: string;
  /** Server-computed. Null while the account is still loading. */
  account: CreditAccount | null;
  /** This sale's total, from the cart. The server recomputes it at commit. */
  saleAmount: number;
  currency?: string;
  loading?: boolean;
  /** Set when the account couldn't be loaded — confirming is blocked. */
  error?: string | null;
}

/** One figure and its label, on a row. */
const Line: React.FC<{
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'danger';
  strong?: boolean;
}> = ({ label, value, tone = 'default', strong = false }) => (
  <View style={styles.line}>
    <Text style={[styles.lineLabel, tone === 'muted' && styles.mutedText]}>{label}</Text>
    <Text
      style={[
        styles.lineValue,
        strong && styles.lineValueStrong,
        tone === 'danger' && styles.dangerText,
        tone === 'muted' && styles.mutedText,
      ]}
    >
      {value}
    </Text>
  </View>
);

/**
 * What the cashier confirms before a debt exists.
 *
 * Every figure here comes from the server — the limit, the balance, what is
 * still available, the due date. The client's only contribution is the sale
 * total it already computed for the cart, and even that is recomputed from the
 * products at commit, so nothing shown can be talked into a different outcome
 * by editing a request.
 *
 * The layout answers the three questions a shopkeeper actually asks, in order:
 * who is this, what will they owe after this, and when do I chase them.
 */
export const CreditSummarySheet: React.FC<CreditSummarySheetProps> = ({
  visible,
  onClose,
  onConfirm,
  customerName,
  account,
  saleAmount,
  currency,
  loading = false,
  error = null,
}) => {
  const resulting = (account?.outstanding ?? 0) + saleAmount;
  const exceedsLimit = account != null && saleAmount > account.availableCredit;
  const blocked = account != null && !account.canTakeCredit;

  /**
   * The resulting balance settles into place a beat after the sheet opens.
   *
   * It is the one figure here that doesn't exist yet — everything above it is a
   * fact, this is a consequence — and letting it arrive last is what makes the
   * before/after relationship legible instead of just stated. A 16px rise and a
   * fade, once, on the row that matters; the rest of the sheet is already still
   * by the time the eye reaches it.
   */
  const settle = useSharedValue(0);
  useEffect(() => {
    if (!visible || !account) {
      settle.value = 0;
      return;
    }
    settle.value = withDelay(
      120,
      withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.exp),
        reduceMotion: ReduceMotion.System,
      }),
    );
    // settle is a Reanimated shared value with a stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, account]);

  const resultingStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [{ translateY: (1 - settle.value) * 16 }],
  }));

  const canConfirm = !loading && !!account && !exceedsLimit && !blocked && !error;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeightPercent={78}
      footer={
        <View style={styles.footer}>
          <Button title="Back" variant="ghost" onPress={onClose} style={styles.footerBtn} />
          <Button
            title="Confirm Credit Sale"
            leftIcon="checkmark-circle-outline"
            onPress={onConfirm}
            disabled={!canConfirm}
            loading={loading}
            style={styles.footerBtnPrimary}
            accessibilityHint={
              canConfirm
                ? undefined
                : exceedsLimit
                  ? 'This sale is more than the customer has available'
                  : 'The customer cannot take credit right now'
            }
          />
        </View>
      }
    >
      <View style={styles.body}>
        <Text style={styles.heading}>Sell on credit</Text>
        <Text style={styles.customer} numberOfLines={1}>{customerName}</Text>

        {error ? (
          <View style={styles.notice}>
            <Ionicons name="cloud-offline-outline" size={16} color={Colors.danger} />
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : !account ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Checking their account…</Text>
          </View>
        ) : (
          <>
            <View style={styles.block}>
              <Line
                label="Owes now"
                value={formatCurrency(account.outstanding, currency)}
              />
              <Line
                label="Credit limit"
                value={formatCurrency(account.creditLimit, currency)}
                tone="muted"
              />
              <Line
                label="Available"
                value={formatCurrency(account.availableCredit, currency)}
                tone={exceedsLimit ? 'danger' : 'default'}
              />
            </View>

            <View style={styles.block}>
              <Line label="This sale" value={formatCurrency(saleAmount, currency)} />
            </View>

            <Animated.View style={[styles.resultBlock, resultingStyle]}>
              <Line
                label="Will owe"
                value={formatCurrency(resulting, currency)}
                strong
                tone={exceedsLimit ? 'danger' : 'default'}
              />
              <Line
                label="Due"
                value={formatDate(account.dueAtPreview)}
                tone="muted"
              />
            </Animated.View>

            {/* Say why the button is off. Greyed says "not now" to anyone who
                can see it and nothing at all to anyone who can't. */}
            {exceedsLimit && (
              <View style={[styles.notice, styles.noticeDanger]}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                <Text style={styles.noticeText}>
                  Credit limit reached. {customerName} has{' '}
                  {formatCurrency(account.availableCredit, currency)} available.
                </Text>
              </View>
            )}
            {!exceedsLimit && blocked && (
              <View style={[styles.notice, styles.noticeDanger]}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                <Text style={styles.noticeText}>
                  {account.blocked
                    ? (account.blockedReason
                      ? `${customerName} is blocked from credit: ${account.blockedReason}`
                      : `${customerName} is blocked from taking credit.`)
                    : account.overdueAmount > 0
                      ? `${customerName} has ${formatCurrency(account.overdueAmount, currency)} overdue. Take a repayment first.`
                      : `${customerName} can't take credit right now.`}
                </Text>
              </View>
            )}
          </>
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
  block: {
    gap: 6,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  // The consequence, set apart from the facts above it.
  resultBlock: {
    gap: 6,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
  },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  lineLabel: {
    flex: 1,
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
  },
  lineValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  lineValueStrong: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
  },
  mutedText: { color: Colors.textSecondary },
  dangerText: { color: Colors.danger },
  notice: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dangerSubtle,
  },
  noticeDanger: { backgroundColor: Colors.dangerSubtle },
  noticeText: {
    flex: 1,
    fontSize: Typography.size.caption,
    color: Colors.danger,
    lineHeight: 17,
  },
  loadingBlock: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  loadingText: { fontSize: Typography.size.small, color: Colors.textSecondary },
  footer: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  footerBtn: { flex: 1 },
  footerBtnPrimary: { flex: 2 },
});
