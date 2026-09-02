import React, { useState, useMemo } from 'react';
import { View, RefreshControl, StyleSheet, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useAlert } from '@/context/AlertContext';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { MONEY_OUT_METHOD_LABELS } from '@/constants/paymentMethods';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ContextualSearchBar } from '@/components/ui/ContextualSearchBar';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  getExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
  type Expense,
  type ExpenseCategory,
  type CreateExpenseData,
} from '@/services/expenses';
import { ExpenseFormSheet } from '@/components/expenses/ExpenseFormSheet';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { useSearch, localFilter } from '@/hooks/useSearch';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { isOfflineQueued, mutationErrorMessage } from '@/utils/errors';
import { QueryError } from '@/components/ui/QueryError';

const CATEGORY_ICONS: Record<ExpenseCategory, keyof typeof Ionicons.glyphMap> = {
  rent: 'home-outline',
  utilities: 'flash-outline',
  supplies: 'cube-outline',
  transport: 'car-outline',
  salaries: 'people-outline',
  marketing: 'megaphone-outline',
  other: 'ellipsis-horizontal-outline',
};

/** Shared expense list/form screen mounted from both (owner) and (staff) route
 * groups — owners implicitly have `manage_expenses`, staff need it granted. */
export const ExpensesScreen: React.FC = () => {
  const tabBarHeight = useTabBarHeight();
  const user = useAuthStore((s: AuthState) => s.user);
  const currency = user?.shop?.currency;
  const canManageExpenses = usePermission('manage_expenses');
  const [formVisible, setFormVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { alert, toast } = useAlert();

  const {
    value: searchValue,
    query: searchQuery,
    onChange: onSearchChange,
    onSubmit: onSearchSubmit,
    selectRecent,
    recentSearches,
    clearRecent,
    clear: clearSearch,
    isSearching,
  } = useSearch('expenses');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['expenses', page],
    queryFn: () => getExpenses({ page, limit: 10 }),
    enabled: canManageExpenses,
    // Keep the current page's expenses mounted while the next page loads,
    // instead of the whole screen dropping to a full-screen loading state.
    placeholderData: keepPreviousData,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['expenseSummary'],
    queryFn: () => getExpenseSummary(),
    enabled: canManageExpenses,
  });

  const saveMutation = useMutation({
    mutationFn: (data: CreateExpenseData) =>
      editingExpense ? updateExpense(editingExpense._id, data) : createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
      setPage(1);
      setFormVisible(false);
      setEditingExpense(null);
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        setFormVisible(false);
        setEditingExpense(null);
        toast({ type: 'info', message: 'Expense saved offline. Will sync when connected.' });
        return;
      }
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not save expense') });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
      setPage(1);
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        toast({ type: 'info', message: 'Deletion will sync when connected.' });
        return;
      }
      toast({ type: 'error', message: mutationErrorMessage(error, 'Deletion failed') });
    },
  });

  const handleDelete = (expense: Expense) => {
    alert({
      type: 'confirm',
      title: 'Delete Expense',
      message: 'Delete this expense? This cannot be undone.',
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Delete', variant: 'danger', onPress: () => deleteMutation.mutate(expense._id) },
      ],
    });
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormVisible(true);
  };

  const openAdd = () => {
    setEditingExpense(null);
    setFormVisible(true);
  };

  const allExpenses = useMemo(() => data?.data || [], [data]);
  const totalPages = data?.pagination?.pages ?? 1;

  const expenses = useMemo(() => {
    if (!searchQuery) return allExpenses;
    return localFilter(allExpenses, searchQuery, (e) => [
      e.category,
      e.description,
      formatDate(e.date),
    ]);
  }, [allExpenses, searchQuery]);

  if (!canManageExpenses) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>You do not have permission to manage expenses.</Text>
      </View>
    );
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError && allExpenses.length === 0) {
    return <QueryError onRetry={refetch} />;
  }

  const summary = summaryData?.data;

  return (
    <Animated.View entering={FadeIn.duration(Motion.duration.slow)} style={styles.container}>
      {/* The navigator's header is switched off for this route so the screen
          owns one header rather than stacking a second title under it. */}
      <ScreenHeader
        title="Expenses"
        bordered={false}
        backgroundColor={Colors.background}
        right={<Button title="Add Expense" onPress={openAdd} size="sm" />}
      />

      {/* Summary always visible — not affected by search */}
      {!isSearching && (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Total Recorded</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary?.total || 0, currency)}</Text>
        </View>
      )}

      {/* Compact summary shown while searching so context is preserved */}
      {isSearching && (
        <View style={styles.summaryCompact}>
          <Text style={styles.summaryCompactLabel}>
            Total: <Text style={styles.summaryCompactValue}>{formatCurrency(summary?.total || 0, currency)}</Text>
          </Text>
        </View>
      )}

      <ContextualSearchBar
        value={searchValue}
        onChangeText={onSearchChange}
        onSubmit={onSearchSubmit}
        recentSearches={recentSearches}
        onSelectRecent={selectRecent}
        onClearRecent={clearRecent}
        placeholder="Search by category or description…"
        style={styles.searchBar}
      />

      <FlashList
        showsVerticalScrollIndicator={false}
        data={expenses}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => (
          <ListRow
            title={item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            subtitle={[
              item.description,
              formatDate(item.date),
              // Cash is the overwhelming default and the value every pre-field
              // record carries — only worth the pixels when it's something else.
              item.paymentMethod && item.paymentMethod !== 'cash'
                ? MONEY_OUT_METHOD_LABELS[item.paymentMethod]
                : null,
            ].filter(Boolean).join(' · ')}
            icon={CATEGORY_ICONS[item.category]}
            isLast={index === expenses.length - 1}
            onPress={() => openEdit(item)}
            trailing={
              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmount}>{formatCurrency(item.amount, currency)}</Text>
                <AnimatedPressable
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete expense: ${item.description}`}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                </AnimatedPressable>
              </View>
            }
          />
        )}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: tabBarHeight + Spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          isSearching ? (
            <View style={styles.emptySearch}>
              <Ionicons name="search-outline" size={36} color={Colors.textTertiary} />
              <Text style={styles.emptySearchTitle}>No expenses found</Text>
              <Text style={styles.emptySearchSub}>
                No results for &quot;{searchValue}&quot;. Try a different term or{' '}
              </Text>
              <AnimatedPressable onPress={clearSearch}>
                <Text style={styles.emptySearchLink}>clear search</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <EmptyState title="No expenses recorded" subtitle="Add your first expense to start tracking spending." />
          )
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.paginationBar}>
              <AnimatedPressable
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={`Previous page, page ${page - 1}`}
                accessibilityState={{ disabled: page <= 1 }}
              >
                <Ionicons name="chevron-back" size={16} color={page <= 1 ? Colors.textSecondary : Colors.primary} />
              </AnimatedPressable>
              <Text style={styles.pageLabel}>Page {page} of {totalPages}</Text>
              <AnimatedPressable
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={`Next page, page ${page + 1}`}
                accessibilityState={{ disabled: page >= totalPages }}
              >
                <Ionicons name="chevron-forward" size={16} color={page >= totalPages ? Colors.textSecondary : Colors.primary} />
              </AnimatedPressable>
            </View>
          ) : null
        }
      />

      <ExpenseFormSheet
        visible={formVisible}
        onClose={() => { setFormVisible(false); setEditingExpense(null); }}
        onSave={(data) => saveMutation.mutate(data)}
        expense={editingExpense}
        loading={saveMutation.isPending}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  empty: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center' },

  summary: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  summaryLabel: { fontSize: Typography.size.small, color: Colors.textSecondary },
  summaryValue: {
    fontSize: Typography.size.display,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginTop: 2,
  },

  // Condensed summary row shown while actively searching
  summaryCompact: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  summaryCompactLabel: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
  },
  summaryCompactValue: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },

  searchBar: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },

  expenseRight: { alignItems: 'flex-end', gap: Spacing.xs },
  expenseAmount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },

  // Pagination
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: Spacing.lg,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: { borderColor: Colors.border },
  pageLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },

  // Search empty state
  emptySearch: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
  },
  emptySearchTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  emptySearchSub: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptySearchLink: {
    fontSize: Typography.size.small,
    color: Colors.primary,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
