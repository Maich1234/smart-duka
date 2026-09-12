import React, { useState, useMemo } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useAlert } from '@/context/AlertContext';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ListFooterLoader } from '@/components/ui/ListFooterLoader';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getProducts, deleteProduct, updateStock, type Product } from '@/services/products';
import { getDepletionAnalytics } from '@/services/analytics';
import { InventoryHeader } from '@/components/inventory/InventoryHeader';
import { ProductCard } from '@/components/inventory/ProductCard';
import { InventoryStatsRow } from '@/components/inventory/InventoryStatsRow';
import { StockUpdateModal } from '@/components/inventory/StockUpdateModal';
import { useSearch, localFilter } from '@/hooks/useSearch';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';
import { QueryError } from '@/components/ui/QueryError';

type VelocityFilter = 'all' | 'fast' | 'slow' | 'stockout';

interface FilterOption {
  value: VelocityFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeGradient: readonly [string, string];
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    value: 'all',
    label: 'All',
    icon: 'apps-outline',
    activeGradient: ['#0F766E', '#14B8A6'],
  },
  {
    value: 'fast',
    label: 'Fast Movers',
    icon: 'trending-up-outline',
    activeGradient: ['#14532D', '#16A34A'],
  },
  {
    value: 'slow',
    label: 'Slow Movers',
    icon: 'trending-down-outline',
    activeGradient: ['#78350F', '#D97706'],
  },
  {
    value: 'stockout',
    label: 'Stockout Soon',
    icon: 'alert-circle-outline',
    activeGradient: ['#7F1D1D', '#DC2626'],
  },
];

export default function OwnerInventory() {
  const tabBarHeight = useTabBarHeight();
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
  } = useSearch('inventory');
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [velocityFilter, setVelocityFilter] = useState<VelocityFilter>('all');
  const queryClient = useQueryClient();
  const { alert, toast } = useAlert();

  const { data: depletionData } = useQuery({
    queryKey: ['depletionAnalytics'],
    queryFn: () => getDepletionAnalytics(),
  });
  const depletion = depletionData?.data;

  // The search term is the query key, so typing restarts paging on its own —
  // there is no page state left to keep in step with it.
  const {
    data, isLoading, isRefetching, isError, refetch,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    // 'paged' namespaces the infinite cache entry away from the plain
    // useQuery consumers of the same entity. React Query keeps ONE entry per
    // key, and an infinite query stores { pages, pageParams } where a plain
    // one stores the response itself — sharing a key makes whichever ran last
    // hand the other a shape it cannot read. Prefix invalidation on
    // ['<entity>'] still matches this.
    queryKey: ['products', 'paged', searchQuery],
    queryFn: ({ pageParam }) => getProducts({ search: searchQuery, page: pageParam, limit: 10 }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ type: 'success', message: 'Product deleted' });
    },
    onError: (error: any) =>
      toast({ type: 'error', message: error.response?.data?.message || 'Deletion failed' }),
  });

  const stockMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      updateStock(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setStockModalVisible(false);
      toast({ type: 'success', message: 'Stock updated successfully' });
    },
    onError: (error: any) =>
      toast({ type: 'error', message: error.response?.data?.message || 'Stock update failed' }),
  });

  const handleDelete = (id: string) => {
    alert({
      type: 'confirm',
      title: 'Delete Product',
      message: 'This action cannot be undone. Are you sure?',
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Delete', variant: 'danger', onPress: () => deleteMutation.mutate(id) },
      ],
    });
  };

  const openStockModal = (product: Product) => {
    setSelectedProductForStock(product);
    setStockModalVisible(true);
  };

  const handleStockUpdate = (quantity: number) => {
    if (selectedProductForStock) {
      stockMutation.mutate({ id: selectedProductForStock._id, quantity });
    }
  };

  const allProducts = useMemo<Product[]>(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  // First page carries the authoritative count; later pages only a lower bound.
  const catalogueTotal = data?.pages[0]?.pagination.total ?? allProducts.length;
  const hasMorePages = !!hasNextPage;

  // Apply local search on top of server results so matches are instant while
  // the debounced API call is still in-flight (covers SKU, name, category).
  const products = useMemo(() => {
    if (!searchQuery) return allProducts;
    return localFilter(allProducts, searchQuery, (p) => [
      p.name,
      p.category,
      p.description,
      p.sku,
      // Search variant SKUs so "SKU-123" still finds the right product
      ...(p.variants?.map((v) => v.sku).filter(Boolean) ?? []),
    ]);
  }, [allProducts, searchQuery]);

  const fastIds = useMemo(
    () => new Set(depletion?.fastMovers.map((i) => i.productId) || []),
    [depletion],
  );
  const slowIds = useMemo(
    () => new Set(depletion?.slowMovers.map((i) => i.productId) || []),
    [depletion],
  );
  const stockoutIds = useMemo(
    () => new Set(depletion?.stockoutSoon.map((i) => i.productId) || []),
    [depletion],
  );

  const filteredProducts = useMemo(() => {
    if (velocityFilter === 'fast') return products.filter((p) => fastIds.has(p._id));
    if (velocityFilter === 'slow') return products.filter((p) => slowIds.has(p._id));
    if (velocityFilter === 'stockout') return products.filter((p) => stockoutIds.has(p._id));
    return products;
  }, [products, velocityFilter, fastIds, slowIds, stockoutIds]);

  const filterCounts: Record<VelocityFilter, number> = {
    // Use server total so "All" shows full catalogue count, not the 10-item page slice
    all: catalogueTotal,
    fast: fastIds.size,
    slow: slowIds.size,
    stockout: stockoutIds.size,
  };

  const stats = useMemo(() => {
    const lowStockCount = allProducts.filter(
      (p) => p.trackInventory !== false && p.quantity > 0 && p.quantity <= p.lowStockAlert,
    ).length;
    const totalValue = allProducts.reduce(
      (sum, p) => sum + (p.costPrice ?? 0) * p.quantity,
      0,
    );
    return {
      // Use server pagination total so the stats card reflects the full catalogue
      totalProducts: catalogueTotal,
      lowStockCount,
      stockoutSoonCount: stockoutIds.size,
      totalValue,
      // Flags that value/lowStock counts cover only what has been loaded so
      // far, not the whole catalogue — still true while pages remain unread.
      isPageScope: hasMorePages,
    };
  }, [allProducts, stockoutIds, catalogueTotal, hasMorePages]);

  const alertCount = stats.lowStockCount + stats.stockoutSoonCount;

  if (isLoading && allProducts.length === 0) {
    return <ListSkeleton rows={6} heroHeight={120} showSearch />;
  }

  if (isError && allProducts.length === 0) {
    return <QueryError onRetry={refetch} />;
  }

  return (
    <Animated.View entering={FadeIn.duration(Motion.duration.slow)} style={styles.container}>
      {/* ── Fixed header: title + search ─────────────────────────────────── */}
      <InventoryHeader
        onAddPress={() => router.push('/(owner)/inventory/new')}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        recentSearches={recentSearches}
        onSelectRecent={selectRecent}
        onClearRecent={clearRecent}
        productCount={catalogueTotal}
        alertCount={alertCount}
        onBellPress={() => router.push('/(owner)/notifications')}
      />

      {/* ── Fixed filter chips ────────────────────────────────────────────── */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          decelerationRate="fast"
        >
          {FILTER_OPTIONS.map((opt) => {
            const isActive = velocityFilter === opt.value;
            const count = filterCounts[opt.value];
            const showBadge = opt.value !== 'all' && count > 0;
            return (
              <AnimatedPressable
                key={opt.value}
                onPress={() => setVelocityFilter(opt.value)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected: isActive }}
              >
                {isActive && (
                  <LinearGradient
                    colors={opt.activeGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Ionicons
                  name={opt.icon}
                  size={13}
                  color={isActive ? Colors.white : Colors.textSecondary}
                />
                <Text
                  style={[styles.filterChipText, isActive && styles.filterChipTextActive]}
                >
                  {opt.label}
                </Text>
                {showBadge && (
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor: isActive
                          ? 'rgba(255,255,255,0.22)'
                          : Colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countBadgeText,
                        { color: isActive ? Colors.white : Colors.textSecondary },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Product list ──────────────────────────────────────────────────── */}
      <FlashList
        showsVerticalScrollIndicator={false}
        data={filteredProducts}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => (
          <ProductCard
            product={item}
            showCostPrice
            showActions
            isLast={index === filteredProducts.length - 1}
            index={index}
            onPress={() => router.push(`/(owner)/inventory/${item._id}/edit`)}
            onEdit={() => router.push(`/(owner)/inventory/${item._id}/edit`)}
            onDelete={() => handleDelete(item._id)}
            onUpdateStock={() => openStockModal(item)}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.lg },
        ]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        // Pages load as the owner scrolls rather than from Prev/Next buttons.
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<ListFooterLoader loading={isFetchingNextPage} />}
        ListHeaderComponent={
          // Plain wrapper: the stat cards inside stagger themselves in, and an
          // `entering` here would be a second animation on the same path —
          // which can leave those cards stuck at their start offset.
          <View>
            <InventoryStatsRow stats={stats} />
            {/* Intelligence banner — shows when depletion data is ready */}
            {depletion &&
              (depletion.fastMovers.length > 0 || depletion.stockoutSoon.length > 0) && (
                <IntelligenceBanner
                  fastCount={depletion.fastMovers.length}
                  stockoutCount={depletion.stockoutSoon.length}
                  onViewFast={() => setVelocityFilter('fast')}
                  onViewStockout={() => setVelocityFilter('stockout')}
                />
              )}
            {velocityFilter !== 'all' && hasMorePages && (
              <View style={styles.filterScopeNote}>
                <Ionicons name="information-circle-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.filterScopeText}>
                  Showing matches loaded so far. Keep scrolling to see all{' '}
                  {filterCounts[velocityFilter]} items.
                </Text>
              </View>
            )}
            <View style={styles.listSectionLabel}>
              <Text style={styles.sectionLabelText}>
                {velocityFilter === 'all' ? 'ALL PRODUCTS' : FILTER_OPTIONS.find((o) => o.value === velocityFilter)?.label.toUpperCase()}
              </Text>
              <Text style={styles.sectionLabelCount}>{filteredProducts.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyInventoryState
            hasSearch={isSearching}
            onAddProduct={() => router.push('/(owner)/inventory/new')}
            onClearSearch={clearSearch}
          />
        }
      />

      <StockUpdateModal
        visible={stockModalVisible}
        onClose={() => setStockModalVisible(false)}
        onConfirm={handleStockUpdate}
        currentStock={selectedProductForStock?.quantity || 0}
        productName={selectedProductForStock?.name || ''}
        loading={stockMutation.isPending}
      />
    </Animated.View>
  );
}

// ─── Intelligence Banner ──────────────────────────────────────────────────────

interface IntelligenceBannerProps {
  fastCount: number;
  stockoutCount: number;
  onViewFast: () => void;
  onViewStockout: () => void;
}

function IntelligenceBanner({
  fastCount,
  stockoutCount,
  onViewFast,
  onViewStockout,
}: IntelligenceBannerProps) {
  return (
    <View style={bannerStyles.container}>
      <View style={bannerStyles.header}>
        <Ionicons name="sparkles" size={14} color={Colors.primary} />
        <Text style={bannerStyles.title}>Inventory Intelligence</Text>
      </View>
      <View style={bannerStyles.chips}>
        {fastCount > 0 && (
          <AnimatedPressable
            onPress={onViewFast}
            style={[bannerStyles.chip, bannerStyles.chipGreen]}
          >
            <Ionicons name="trending-up" size={13} color="#15803D" />
            <Text style={[bannerStyles.chipText, { color: '#15803D' }]}>
              {fastCount} fast mover{fastCount !== 1 ? 's' : ''}: tap to view
            </Text>
          </AnimatedPressable>
        )}
        {stockoutCount > 0 && (
          <AnimatedPressable
            onPress={onViewStockout}
            style={[bannerStyles.chip, bannerStyles.chipRed]}
          >
            <Ionicons name="alert-circle" size={13} color="#DC2626" />
            <Text style={[bannerStyles.chipText, { color: '#DC2626' }]}>
              {stockoutCount} item{stockoutCount !== 1 ? 's' : ''} stocking out soon
            </Text>
          </AnimatedPressable>
        )}
      </View>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primarySubtle,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  chipGreen: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  chipRed: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  chipText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
  },
});

// ─── Empty State ──────────────────────────────────────────────────────────────

interface EmptyInventoryStateProps {
  hasSearch: boolean;
  onAddProduct: () => void;
  onClearSearch: () => void;
}

function EmptyInventoryState({ hasSearch, onAddProduct, onClearSearch }: EmptyInventoryStateProps) {
  return (
    <View style={emptyStyles.container}>
      <View style={emptyStyles.iconWrap}>
        <Ionicons name={hasSearch ? 'search-outline' : 'cube-outline'} size={40} color={Colors.textTertiary} />
      </View>
      <Text style={emptyStyles.title}>
        {hasSearch ? 'No products found' : 'No products yet'}
      </Text>
      <Text style={emptyStyles.subtitle}>
        {hasSearch
          ? 'Try a different search term or clear the filter to see all products.'
          : 'Start tracking your stock by adding your first product. Manage pricing, quantities, and get smart restocking alerts.'}
      </Text>
      {hasSearch ? (
        <AnimatedPressable onPress={onClearSearch} style={emptyStyles.secondaryAction}>
          <Text style={emptyStyles.secondaryActionText}>Clear Search</Text>
        </AnimatedPressable>
      ) : (
        <AnimatedPressable
          onPress={onAddProduct}
          style={emptyStyles.primaryAction}
        >
          <Ionicons name="add" size={18} color={Colors.white} />
          <Text style={emptyStyles.primaryActionText}>Add First Product</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.small,
    marginBottom: Spacing.lg,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryActionText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.white,
  },
  secondaryAction: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  secondaryActionText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
});

// ─── Main styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Filter bar
  filterBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  filterChipActive: {
    borderColor: 'transparent',
  },
  filterChipText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
  },

  // List
  listContent: {
    paddingTop: Spacing.md,
  },
  filterScopeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  filterScopeText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  listSectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionLabelText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#94A3B8',
    letterSpacing: 1.0,
  },
  sectionLabelCount: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
  },
});
