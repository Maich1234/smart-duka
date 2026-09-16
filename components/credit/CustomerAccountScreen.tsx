import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAlert } from '@/context/AlertContext';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useAuthStore } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { getCustomerById, type CreditTransaction } from '@/services/customers';
import { getShopConfig } from '@/services/shop';
import { recordCreditPayment, reverseCreditTransaction } from '@/services/credit';
import { mutationErrorMessage } from '@/utils/errors';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { AnimatedBalance } from './AnimatedBalance';
import { CreditStatusPill } from './CreditStatusPill';
import { CreditTransactionRow } from './CreditTransactionRow';
import { RecordPaymentSheet } from './RecordPaymentSheet';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';

interface CustomerAccountScreenProps {
  customerId: string;
}

/**
 * One customer's account.
 *
 * Prioritises exactly what the brief asks for, in order: the current balance
 * and what's available, then a clean timeline. Record Payment is obvious but
 * controlled — it renders only for someone with record_credit_payment, and it
 * disappears entirely (not greys out) once the balance is zero, because a
 * button for an action that cannot happen is a lie the interface is telling.
 */
export const CustomerAccountScreen: React.FC<CustomerAccountScreenProps> = ({ customerId }) => {
  const tabBarHeight = useTabBarHeight();
  const currency = useAuthStore((s) => s.user?.shop?.currency);
  const isOwner = useAuthStore((s) => s.user?.role === 'owner');
  const canRecordPayment = usePermission('record_credit_payment');
  const { toast, alert } = useAlert();
  const queryClient = useQueryClient();
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomerById(customerId, { limit: 30 }),
  });

  const { data: shopConfig } = useQuery({ queryKey: ['shopConfig'], queryFn: getShopConfig });

  const paymentMutation = useMutation({
    mutationFn: (body: { amount: number; paymentMethod: string; reference?: string }) =>
      recordCreditPayment(customerId, body),
    onSuccess: (res) => {
      setPaymentSheetVisible(false);
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['creditOverview'] });
      toast({ type: 'success', message: res.message });
    },
    onError: (error) => {
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not record the payment') });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reverseCreditTransaction(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['creditOverview'] });
      toast({ type: 'success', message: 'Entry reversed.' });
    },
    onError: (error) => {
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not reverse that entry') });
    },
  });

  const handleTransactionPress = (tx: CreditTransaction) => {
    if (!isOwner) return;
    if (tx.status === 'reversed' || !!tx.reversedBy) return;
    if (tx.type !== 'CREDIT_SALE' && tx.type !== 'CREDIT_OPENING_BALANCE' && tx.type !== 'CREDIT_PAYMENT') return;

    const isDebt = tx.type !== 'CREDIT_PAYMENT';
    if (isDebt && tx.outstanding != null && tx.outstanding < tx.amount) {
      alert({
        type: 'info',
        title: 'Already partly repaid',
        message: 'Reverse the repayment first if this debt needs to be cancelled.',
      });
      return;
    }

    alert({
      type: 'confirm',
      title: isDebt ? 'Cancel this debt?' : 'Reverse this payment?',
      message: isDebt
        ? `This writes off ${formatCurrency(tx.amount, currency)}. The original entry stays in the history with the correction beside it.`
        : `This puts ${formatCurrency(tx.amount, currency)} back onto the customer's balance. Use this only to undo a mistake.`,
      buttons: [
        { label: 'Never mind', variant: 'ghost' },
        {
          label: isDebt ? 'Cancel Debt' : 'Reverse Payment',
          variant: 'danger',
          onPress: () => reverseMutation.mutate({
            id: tx._id,
            reason: isDebt ? 'Cancelled by owner' : 'Reversed by owner',
          }),
        },
      ],
    });
  };

  if (isLoading) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Customer" />
        <ListSkeleton rows={5} heroHeight={140} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Customer" />
        <QueryError onRetry={refetch} />
      </View>
    );
  }

  const customer = data.data;
  const account = customer.account;
  const showRecordPayment = canRecordPayment && account && account.outstanding > 0;

  return (
    <View style={styles.flex}>
      <ScreenHeader title={customer.name} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        {account ? (
          <Animated.View entering={FadeInDown.duration(Motion.duration.slow)} style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Current balance</Text>
              {/* Server-computed — never derived from the device clock during render. */}
              <CreditStatusPill status={account.status} daysOverdue={account.daysOverdue} />
            </View>
            <AnimatedBalance value={account.outstanding} currency={currency} style={styles.balanceValue} />

            <View style={styles.balanceMetaRow}>
              <View style={styles.balanceMetaItem}>
                <Text style={styles.balanceMetaLabel}>Available</Text>
                <Text style={styles.balanceMetaValue}>{formatCurrency(account.availableCredit, currency)}</Text>
              </View>
              <View style={styles.balanceMetaDivider} />
              <View style={styles.balanceMetaItem}>
                <Text style={styles.balanceMetaLabel}>Limit</Text>
                <Text style={styles.balanceMetaValue}>
                  {formatCurrency(account.creditLimit, currency)}
                  {account.creditLimitSource === 'customer' ? ' ·' : ''}
                </Text>
              </View>
              {account.oldestDueAt && (
                <>
                  <View style={styles.balanceMetaDivider} />
                  <View style={styles.balanceMetaItem}>
                    <Text style={styles.balanceMetaLabel}>Next due</Text>
                    <Text style={styles.balanceMetaValue}>{formatDate(account.oldestDueAt)}</Text>
                  </View>
                </>
              )}
            </View>

            {account.blocked && (
              <View style={styles.blockedNotice}>
                <Ionicons name="ban-outline" size={14} color={Colors.danger} />
                <Text style={styles.blockedText}>
                  {account.blockedReason ? `Blocked: ${account.blockedReason}` : 'Blocked from taking new credit'}
                </Text>
              </View>
            )}
          </Animated.View>
        ) : (
          <View style={styles.contactOnlyCard}>
            <Text style={styles.contactOnlyText}>
              You don&rsquo;t have permission to view this customer&rsquo;s credit account.
            </Text>
          </View>
        )}

        {customer.phone ? (
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.contactText}>{customer.phone}</Text>
          </View>
        ) : null}

        {isOwner && (
          <AnimatedPressable
            onPress={() => router.push({ pathname: '/(owner)/customers/[id]/edit', params: { id: customerId } } as never)}
            style={styles.editRow}
            accessibilityRole="button"
            accessibilityLabel="Edit customer details and credit limit"
          >
            <Ionicons name="create-outline" size={15} color={Colors.primary} />
            <Text style={styles.editRowText}>Edit details & credit limit</Text>
            <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
          </AnimatedPressable>
        )}

        {showRecordPayment && (
          <View style={styles.actionRow}>
            <Button
              title="Record Payment"
              leftIcon="cash-outline"
              onPress={() => setPaymentSheetVisible(true)}
            />
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>History</Text>
          {customer.scopedToSelf && (
            <Text style={styles.sectionHint}>Showing entries you recorded</Text>
          )}
        </View>

        {customer.transactions.length === 0 ? (
          <EmptyState
            title="No credit history yet"
            subtitle={
              account
                ? 'Sales made on credit and repayments will appear here.'
                : 'Nothing to show for this view.'
            }
          />
        ) : (
          <View style={styles.timelineCard}>
            {customer.transactions.map((tx, i) => (
              <CreditTransactionRow
                key={tx._id}
                transaction={tx}
                currency={currency}
                isLast={i === customer.transactions.length - 1}
                onPress={isOwner ? () => handleTransactionPress(tx) : undefined}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {account && (
        <RecordPaymentSheet
          visible={paymentSheetVisible}
          onClose={() => setPaymentSheetVisible(false)}
          onConfirm={(body) => paymentMutation.mutate(body)}
          customerName={customer.name}
          outstanding={account.outstanding}
          shopMethods={shopConfig?.data?.paymentMethods}
          currency={currency}
          loading={paymentMutation.isPending}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  balanceCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  balanceValue: {
    fontSize: 34,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  balanceMetaRow: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  balanceMetaItem: { flex: 1, gap: 2 },
  balanceMetaLabel: { fontSize: 10, color: Colors.textSecondary },
  balanceMetaValue: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  balanceMetaDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.divider, marginHorizontal: Spacing.sm },
  blockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    padding: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dangerSubtle,
  },
  blockedText: { fontSize: 12, color: Colors.danger, flex: 1 },
  contactOnlyCard: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactOnlyText: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center' },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  contactText: { fontSize: Typography.size.small, color: Colors.textSecondary },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingVertical: 8,
  },
  editRowText: { flex: 1, fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.primary },
  actionRow: { marginHorizontal: Spacing.lg, marginTop: Spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionHint: { fontSize: 11, color: Colors.textTertiary },
  timelineCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
});
