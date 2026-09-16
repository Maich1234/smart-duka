import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { useAlert } from '@/context/AlertContext';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useAuthStore } from '@/store/authStore';
import { getUntrackedCreditSales, recordOpeningBalance, type UntrackedCreditSale } from '@/services/credit';
import { CustomerPickerSheet } from '@/components/credit/CustomerPickerSheet';
import type { Customer } from '@/services/customers';
import { mutationErrorMessage } from '@/utils/errors';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

/**
 * Brings a pre-existing debt onto the ledger — either by naming the customer
 * on one of the "Credit" sales this shop rang up before the module existed
 * (they were never more than a payment-method label), or by writing down a
 * debt that only ever lived on a chalkboard.
 *
 * Every entry created here is typed CREDIT_OPENING_BALANCE, not CREDIT_SALE —
 * a statement must never claim the shop sold something it didn't — and lands
 * in the audit log with who did it and when.
 */
export default function OpeningBalancesScreen() {
  const tabBarHeight = useTabBarHeight();
  const currency = useAuthStore((s) => s.user?.shop?.currency);
  const { toast } = useAlert();
  const queryClient = useQueryClient();

  const [activeSale, setActiveSale] = useState<UntrackedCreditSale | 'standalone' | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [amountText, setAmountText] = useState('');
  const [dueAt, setDueAt] = useState<Date | undefined>(undefined);
  const [note, setNote] = useState('');

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['credit', 'untrackedSales'],
    queryFn: ({ pageParam = 1 }) => getUntrackedCreditSales({ page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined),
  });
  const sales = data?.pages.flatMap((p) => p.data) ?? [];

  const mutation = useMutation({
    mutationFn: () => recordOpeningBalance({
      customerId: customer!._id,
      amount: Number.parseFloat(amountText || '0'),
      dueAt: dueAt?.toISOString(),
      saleId: activeSale && activeSale !== 'standalone' ? activeSale._id : undefined,
      note: note.trim() || undefined,
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['credit', 'untrackedSales'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['creditOverview'] });
      toast({ type: 'success', message: res.message });
      closeForm();
    },
    onError: (error) => {
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not record the balance') });
    },
  });

  const openForSale = (sale: UntrackedCreditSale) => {
    setActiveSale(sale);
    setAmountText(String(sale.totalAmount));
    setCustomer(null);
    setDueAt(undefined);
    setNote('');
    setPickerVisible(true);
  };

  const openStandalone = () => {
    setActiveSale('standalone');
    setAmountText('');
    setCustomer(null);
    setDueAt(undefined);
    setNote('');
    setPickerVisible(true);
  };

  const closeForm = () => {
    setActiveSale(null);
    setCustomer(null);
    setAmountText('');
    setDueAt(undefined);
    setNote('');
  };

  const amount = Number.parseFloat(amountText);
  const validAmount = Number.isFinite(amount) && amount > 0;

  return (
    <View style={styles.flex}>
      <View style={styles.intro}>
        <Text style={styles.introText}>
          These are past sales rung up as &ldquo;Credit&rdquo; before this shop tracked debts —
          real money someone may still owe, with no record of who. Assign a customer to bring
          it onto the books, or add a debt that never went through a sale.
        </Text>
        <Button title="Add a debt not from a sale" variant="outline" leftIcon="add-circle-outline" onPress={openStandalone} />
      </View>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <QueryError onRetry={refetch} />
      ) : sales.length === 0 ? (
        <EmptyState
          title="Nothing untracked"
          subtitle="Every past “Credit” sale already has a customer, or this shop never used that button before now."
        />
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingHorizontal: Spacing.lg }}
          onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          renderItem={({ item, index }) => (
            <AnimatedPressable
              onPress={() => openForSale(item)}
              style={[styles.saleRow, index < sales.length - 1 && styles.saleDivider]}
              accessibilityRole="button"
              accessibilityLabel={`${formatCurrency(item.totalAmount, currency)} sale from ${formatDate(item.createdAt)}, assign a customer`}
            >
              <View style={styles.saleInfo}>
                <Text style={styles.saleAmount}>{formatCurrency(item.totalAmount, currency)}</Text>
                <Text style={styles.saleMeta} numberOfLines={1}>
                  {formatDate(item.createdAt)} · {item.staffName || 'Unknown'} · {item.itemSummary || `${item.itemCount} items`}
                </Text>
              </View>
              <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
            </AnimatedPressable>
          )}
        />
      )}

      <CustomerPickerSheet
        visible={pickerVisible}
        onClose={() => { setPickerVisible(false); if (!customer) closeForm(); }}
        onSelect={(c) => { setCustomer(c); setPickerVisible(false); }}
      />

      <BottomSheet
        visible={!!activeSale && !!customer}
        onClose={closeForm}
        maxHeightPercent={80}
        footer={
          <View style={styles.footer}>
            <Button title="Cancel" variant="ghost" onPress={closeForm} style={styles.flex1} />
            <Button
              title="Bring Forward"
              onPress={() => mutation.mutate()}
              disabled={!validAmount || mutation.isPending}
              loading={mutation.isPending}
              style={styles.flex2}
            />
          </View>
        }
      >
        <View style={styles.form}>
          <Text style={styles.formHeading}>
            {activeSale === 'standalone' ? 'New opening balance' : 'Assign this sale'}
          </Text>
          <Text style={styles.formCustomer} numberOfLines={1}>{customer?.name}</Text>

          <Input
            label="Amount owed"
            value={amountText}
            onChangeText={(t) => setAmountText(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          {activeSale && activeSale !== 'standalone' && (
            <Text style={styles.saleHint}>
              This sale totalled {formatCurrency(activeSale.totalAmount, currency)}. Enter less if part was already paid.
            </Text>
          )}

          <View>
            <Text style={styles.dateLabel}>Due date (optional)</Text>
            <DatePicker value={dueAt ?? new Date()} onChange={setDueAt} />
            <Text style={styles.dateHint}>Leave blank to use the shop&rsquo;s default collection period from today.</Text>
          </View>

          <Input
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. From the exercise book, July"
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  intro: { padding: Spacing.lg, gap: Spacing.md },
  introText: { fontSize: Typography.size.small, color: Colors.textSecondary, lineHeight: 19 },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
  },
  saleDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  saleInfo: { flex: 1 },
  saleAmount: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  saleMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  form: { paddingHorizontal: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.md },
  formHeading: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  formCustomer: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginTop: -Spacing.sm },
  saleHint: { fontSize: 11, color: Colors.textTertiary, marginTop: -Spacing.sm },
  dateLabel: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, marginBottom: 6 },
  dateHint: { fontSize: 11, color: Colors.textTertiary, marginTop: 6 },
  footer: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
});
