import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ContextualSearchBar } from '@/components/ui/ContextualSearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { ListFooterLoader } from '@/components/ui/ListFooterLoader';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAlert } from '@/context/AlertContext';
import { CreditFilterTabs } from './CreditFilterTabs';
import { CustomerRow } from './CustomerRow';
import { useSearch } from '@/hooks/useSearch';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { usePermission } from '@/utils/permissions';
import { useAuthStore } from '@/store/authStore';
import { getCustomers, createCustomer, type Customer, type CustomerFilter } from '@/services/customers';
import { mutationErrorMessage } from '@/utils/errors';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface CustomerListScreenProps {
  /** Where a row leads — differs only by route group between owner and staff. */
  basePath: '/(owner)/customers' | '/(staff)/customers';
  /** Pre-selects a filter chip — e.g. arriving from the Credit overview's
   * "N more overdue" link should land already showing Overdue, not All. */
  initialFilter?: CustomerFilter;
}

/**
 * The customer directory: search by name or phone, filter by credit status,
 * and see who owes what without opening each account.
 *
 * A staff member without any credit-viewing permission still gets this list —
 * it's the till's customer picker in screen form — but with balances and
 * filters withheld (the server strips both; see customerController). Filters
 * are only rendered here at all for someone who can actually use them.
 */
export const CustomerListScreen: React.FC<CustomerListScreenProps> = ({ basePath, initialFilter = 'all' }) => {
  const tabBarHeight = useTabBarHeight();
  const currency = useAuthStore((s) => s.user?.shop?.currency);
  const isOwner = useAuthStore((s) => s.user?.role === 'owner');
  const { toast } = useAlert();
  const queryClient = useQueryClient();
  // Each usePermission call is its own hook and must run unconditionally
  // every render — `||` would short-circuit and skip the later calls the
  // moment an earlier one returns true, which is exactly the conditional-hook
  // violation react-hooks/rules-of-hooks exists to catch.
  const canViewAllCredit = usePermission('view_all_credit');
  const canViewOwnCredit = usePermission('view_own_credit');
  const canMakeCreditSale = usePermission('make_credit_sale');
  const canRecordCreditPayment = usePermission('record_credit_payment');
  const canSeeCredit = canViewAllCredit || canViewOwnCredit || canMakeCreditSale || canRecordCreditPayment;
  // Mirrors the backend's own gate on POST /customers (owner or make_credit_sale)
  // — the button simply doesn't exist for anyone who'd be refused server-side.
  const canAddCustomer = isOwner || canMakeCreditSale;
  const [filter, setFilter] = useState<CustomerFilter>(initialFilter);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const {
    value: search,
    query: debouncedSearch,
    onChange: setSearch,
    onSubmit,
    recentSearches,
    selectRecent,
    clearRecent,
  } = useSearch('customers_directory');

  const { data, isLoading, isError, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['customers', 'list', debouncedSearch, filter],
      queryFn: ({ pageParam = 1 }) =>
        getCustomers({ search: debouncedSearch || undefined, filter, sort: filter === 'outstanding' ? 'outstanding' : 'name', page: pageParam, limit: 25 }),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined),
    });

  const customers = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const closeAddSheet = () => {
    setAddSheetVisible(false);
    setNewName('');
    setNewPhone('');
  };

  const createMutation = useMutation({
    mutationFn: () => createCustomer({ name: newName.trim(), phone: newPhone.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ type: 'success', message: `${newName.trim()} added.` });
      closeAddSheet();
    },
    onError: (error) => {
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not add the customer') });
    },
  });

  // Stable across renders: the list can grow into the hundreds for a shop
  // that's run credit a while, and a fresh closure per render on every row
  // is needless churn FlatList has to reconcile on each scroll frame.
  const renderCustomer = useCallback(
    ({ item, index }: { item: Customer; index: number }) => (
      <CustomerRow
        customer={item}
        currency={currency}
        index={index}
        isLast={index === customers.length - 1}
        onPress={() => router.push(`${basePath}/${item._id}` as never)}
      />
    ),
    [currency, customers.length, basePath],
  );

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Customers"
        showBack={false}
        right={canAddCustomer ? <Button title="Add" onPress={() => setAddSheetVisible(true)} size="sm" /> : undefined}
      />
      <View style={styles.searchWrap}>
        <ContextualSearchBar
          value={search}
          onChangeText={setSearch}
          onSubmit={onSubmit}
          placeholder="Search by name or phone"
          recentSearches={recentSearches}
          onSelectRecent={selectRecent}
          onClearRecent={clearRecent}
        />
      </View>

      {canSeeCredit && (
        <View style={styles.filterWrap}>
          <CreditFilterTabs value={filter} onChange={setFilter} />
        </View>
      )}

      {isLoading ? (
        <ListSkeleton rows={7} showSearch={false} />
      ) : isError ? (
        <QueryError onRetry={refetch} />
      ) : customers.length === 0 ? (
        <EmptyState
          title={search ? `No one matching “${search}”` : filter !== 'all' ? 'No customers in this filter' : 'No customers yet'}
          subtitle={
            search
              ? 'Check the spelling and try again.'
              : filter !== 'all'
                ? 'Try a different filter.'
                : 'Customers appear here once you sell to them or add them at the till.'
          }
        />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={<ListFooterLoader loading={isFetchingNextPage} />}
          renderItem={renderCustomer}
        />
      )}

      {canAddCustomer && (
        <BottomSheet
          visible={addSheetVisible}
          onClose={closeAddSheet}
          maxHeightPercent={55}
          footer={
            <View style={styles.sheetFooter}>
              <Button title="Cancel" variant="ghost" onPress={closeAddSheet} style={styles.flex1} />
              <Button
                title="Add Customer"
                onPress={() => createMutation.mutate()}
                disabled={newName.trim().length === 0 || createMutation.isPending}
                loading={createMutation.isPending}
                style={styles.flex2}
                accessibilityHint={newName.trim() ? undefined : 'Enter the customer’s name first'}
              />
            </View>
          }
        >
          <View style={styles.sheetBody}>
            <Text style={styles.sheetHeading}>New customer</Text>
            <Input
              label="Name"
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Mama Njeri"
              autoFocus
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Input
              label="Phone (optional)"
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="e.g. 0712345678"
              keyboardType="phone-pad"
              hint="Useful when you need to call about a debt."
            />
          </View>
        </BottomSheet>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  filterWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  sheetBody: { paddingHorizontal: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.sm },
  sheetHeading: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  sheetFooter: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
});
