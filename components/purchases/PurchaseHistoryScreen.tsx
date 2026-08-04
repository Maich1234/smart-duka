import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ContextualSearchBar } from '@/components/ui/ContextualSearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useSearch } from '@/hooks/useSearch';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { getPurchases, type Purchase, type PurchaseStatus } from '@/services/purchases';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { haptics } from '@/utils/haptics';
import { purchasingBasePath } from '@/utils/purchasingRoutes';
import { MONEY_OUT_METHOD_LABELS } from '@/constants/paymentMethods';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

type SortOption = 'newest' | 'oldest' | 'highest_cost' | 'lowest_cost';
type StatusFilter = 'all' | PurchaseStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS: { value: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'newest', label: 'Newest first', icon: 'arrow-down-outline' },
  { value: 'oldest', label: 'Oldest first', icon: 'arrow-up-outline' },
  { value: 'highest_cost', label: 'Highest cost', icon: 'trending-up-outline' },
  { value: 'lowest_cost', label: 'Lowest cost', icon: 'trending-down-outline' },
];

const STATUS_STYLE: Record<PurchaseStatus, { label: string; bg: string; fg: string }> = {
  completed: { label: 'Completed', bg: Colors.successSubtle, fg: Colors.success },
  pending_approval: { label: 'Pending', bg: Colors.warningSubtle, fg: '#B45309' },
  cancelled: { label: 'Cancelled', bg: Colors.dangerSubtle, fg: Colors.danger },
};

const PAGE_SIZE = 15;

interface PurchaseRowProps {
  purchase: Purchase;
  currency?: string;
  onPress: () => void;
}

const PurchaseRow: React.FC<PurchaseRowProps> = ({ purchase, currency, onPress }) => {
  const status = STATUS_STYLE[purchase.status] ?? STATUS_STYLE.completed;
  const itemCount = purchase.items.length;

  return (
    <AnimatedPressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Purchase from ${purchase.supplierName || 'walk-in supplier'} on ${formatDate(purchase.purchaseDate)}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardIconWrap}>
          <Ionicons name="cart-outline" size={16} color={Colors.primary} />
        </View>
        <View style={styles.cardHeadText}>
          <Text style={styles.cardSupplier} numberOfLines={1}>
            {purchase.supplierName || 'Walk-in purchase'}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {formatDate(purchase.purchaseDate)} · {itemCount} item{itemCount === 1 ? '' : 's'}
          </Text>
        </View>
        {/* grandTotal is withheld from staff without 'view_purchase_prices',
            so the row has to read correctly with no money in it at all. */}
        {purchase.grandTotal != null && (
          <Text style={styles.cardAmount}>{formatCurrency(purchase.grandTotal, currency)}</Text>
        )}
      </View>

      <View style={styles.cardBottom}>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusPillText, { color: status.fg }]}>{status.label}</Text>
        </View>
        {purchase.paymentMethod && (
          <Text style={styles.cardTag}>{MONEY_OUT_METHOD_LABELS[purchase.paymentMethod]}</Text>
        )}
        <Text style={styles.cardTag} numberOfLines={1}>{purchase.staff?.name}</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
      </View>
    </AnimatedPressable>
  );
};

/**
 * Purchase history — the searchable record of everything bought, mounted from
 * both (owner)/purchases/history.tsx and (staff)/purchases/history.tsx.
 *
 * Search, status filtering and sorting are all server-side (the backend
 * matches supplier *and* product names, which a client-side filter over one
 * page could not do), so every control resets to page 1.
 */
export function PurchaseHistoryScreen() {
  const role = useAuthStore((s: AuthState) => s.user?.role);
  const currency = useAuthStore((s: AuthState) => s.user?.shop?.currency);
  const base = purchasingBasePath(role);
  const tabBarHeight = useTabBarHeight();
  const canView = usePermission('view_purchases');

  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);

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
  } = useSearch('purchase_history');

  const { data, isLoading, isPlaceholderData, isRefetching, isError, refetch } = useQuery({
    queryKey: ['purchases', searchQuery, status, sort, page],
    queryFn: () =>
      getPurchases({
        search: searchQuery || undefined,
        status: status === 'all' ? undefined : status,
        sort,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: canView,
    // Every filter/sort/page change is a new query key. Without this the whole
    // screen — search bar and chips included — was replaced by a skeleton on
    // each tap, so the control you just used vanished under your finger.
    placeholderData: keepPreviousData,
  });

  const purchases = data?.data ?? [];
  const totalPages = data?.pagination?.pages ?? 1;
  const total = data?.pagination?.total ?? 0;

  const selectStatus = (value: StatusFilter) => {
    haptics.light();
    setStatus(value);
    setPage(1);
  };

  const selectSort = (value: SortOption) => {
    haptics.light();
    setSort(value);
    setSortOpen(false);
    setPage(1);
  };

  if (!canView) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="lock-closed-outline" size={40} color={Colors.textTertiary} />
        <Text style={styles.centerTitle}>No access</Text>
        <Text style={styles.centerSub}>Ask your shop owner to grant you purchasing access.</Text>
      </View>
    );
  }

  if (isLoading && purchases.length === 0) {
    return <ListSkeleton rows={6} showSearch />;
  }

  if (isError && purchases.length === 0) {
    return <QueryError onRetry={refetch} />;
  }

  const activeSort = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];
  const activeStatus = STATUS_FILTERS.find((s) => s.value === status);

  return (
    <View style={styles.flex}>
      <ContextualSearchBar
        value={searchValue}
        onChangeText={onSearchChange}
        onSubmit={onSearchSubmit}
        recentSearches={recentSearches}
        onSelectRecent={selectRecent}
        onClearRecent={clearRecent}
        placeholder="Search by supplier or product…"
        style={styles.searchBar}
      />

      {/* Status filters scroll; sort collapses into one pill that opens a
          sheet. Two stacked scrollers cost ~80px of chrome above the list,
          which on a small phone left barely one purchase visible. */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_FILTERS.map((option) => {
            const active = status === option.value;
            return (
              <AnimatedPressable
                key={option.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => selectStatus(option.value)}
                accessibilityRole="button"
                accessibilityState={active ? { selected: true } : {}}
                accessibilityLabel={`Show ${option.label} purchases`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>

        <AnimatedPressable
          style={styles.sortTrigger}
          onPress={() => {
            haptics.light();
            setSortOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Change sort order. Currently ${activeSort.label}`}
        >
          <Ionicons name={activeSort.icon} size={14} color={Colors.primary} />
          <Ionicons name="chevron-down" size={12} color={Colors.primary} />
        </AnimatedPressable>
      </View>

      <FlashList
        showsVerticalScrollIndicator={false}
        data={purchases}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <PurchaseRow
            purchase={item}
            currency={currency}
            onPress={() => {
              haptics.light();
              router.push(`${base}/${item._id}` as never);
            }}
          />
        )}
        contentContainerStyle={{
          paddingHorizontal: Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListHeaderComponent={
          total > 0 ? (
            <View style={styles.resultRow}>
              <Text style={styles.resultCount}>
                {total} purchase{total === 1 ? '' : 's'}
                {status !== 'all' ? ` · ${activeStatus?.label.toLowerCase()}` : ''}
                {' · '}{activeSort.label.toLowerCase()}
              </Text>
              {/* Placeholder data means the rows below are the previous page's
                  while the new one loads — say so instead of showing them as
                  though they were the result. */}
              {isPlaceholderData && <ActivityIndicator size="small" color={Colors.primary} />}
            </View>
          ) : null
        }
        ListEmptyComponent={
          isSearching ? (
            <View style={styles.emptySearch}>
              <Ionicons name="search-outline" size={36} color={Colors.textTertiary} />
              <Text style={styles.emptySearchTitle}>No purchases found</Text>
              <Text style={styles.emptySearchSub}>Nothing matches “{searchValue}”.</Text>
              <AnimatedPressable onPress={clearSearch} accessibilityRole="button">
                <Text style={styles.emptySearchLink}>Clear search</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <EmptyState
              title="No purchases yet"
              subtitle="Recorded purchases will appear here, newest first."
            />
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
                accessibilityLabel="Previous page"
              >
                <Ionicons name="chevron-back" size={16} color={page <= 1 ? Colors.textTertiary : Colors.primary} />
              </AnimatedPressable>
              <Text style={styles.pageLabel}>Page {page} of {totalPages}</Text>
              <AnimatedPressable
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Next page"
              >
                <Ionicons name="chevron-forward" size={16} color={page >= totalPages ? Colors.textTertiary : Colors.primary} />
              </AnimatedPressable>
            </View>
          ) : null
        }
      />

      <BottomSheet visible={sortOpen} onClose={() => setSortOpen(false)}>
        <View style={styles.sortSheet}>
          <Text style={styles.sortSheetTitle}>Sort purchases</Text>
          {SORT_OPTIONS.map((option) => {
            const active = sort === option.value;
            return (
              <AnimatedPressable
                key={option.value}
                style={[styles.sortOption, active && styles.sortOptionActive]}
                onPress={() => selectSort(option.value)}
                accessibilityRole="button"
                accessibilityState={active ? { selected: true } : {}}
                accessibilityLabel={`Sort by ${option.label}`}
              >
                <Ionicons
                  name={option.icon}
                  size={16}
                  color={active ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>
                  {option.label}
                </Text>
                {active && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
              </AnimatedPressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: 8,
    backgroundColor: Colors.background,
  },
  centerTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 4,
  },
  centerSub: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  searchBar: { marginHorizontal: Spacing.md, marginTop: Spacing.md },

  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingRight: Spacing.md,
    gap: 8,
  },
  filterRow: {
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  chipTextActive: { color: Colors.white },
  sortTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    minHeight: 34,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: Colors.primarySubtle,
  },

  sortSheet: { padding: Spacing.lg, gap: 4 },
  sortSheetTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 52,
    borderRadius: BorderRadius.md,
  },
  sortOptionActive: { backgroundColor: Colors.primarySubtle },
  sortOptionText: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  sortOptionTextActive: { fontFamily: Typography.fontFamilySemiBold, color: Colors.primary },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  resultCount: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    marginBottom: 10,
    gap: 10,
    ...Shadows.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeadText: { flex: 1, gap: 2 },
  cardSupplier: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  cardMeta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  cardAmount: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
  },
  cardTag: {
    flexShrink: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },

  emptySearch: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    gap: 6,
  },
  emptySearchTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  emptySearchSub: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptySearchLink: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    paddingVertical: 8,
  },

  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
});
