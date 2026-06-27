import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useAlert } from '@/context/AlertContext';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  const tabBarHeight = useBottomTabBarHeight();
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', searchQuery],
    queryFn: () => getProducts({ search: searchQuery }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
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

  const allProducts = useMemo(() => data?.data || [], [data]);

  // Apply local search on top of server results so matches are instant while
  // the debounced API call is still in-flight (covers SKU, name, category).
  const products = useMemo(() => {
    if (!searchQuery) return allProducts;
    return localFilter(allProducts, searchQuery, (p) => [
      p.name,
      p.category,
      p.description,
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
    all: allProducts.length,
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
      totalProducts: allProducts.length,
      lowStockCount,
      stockoutSoonCount: stockoutIds.size,
      totalValue,
    };
  }, [allProducts, stockoutIds]);

  const alertCount = stats.lowStockCount + stats.stockoutSoonCount;

  if (isLoading && allProducts.length === 0) {
    return <LoadingState />;
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
        productCount={allProducts.length}
        alertCount={alertCount}
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
              <TouchableOpacity
                key={opt.value}
                onPress={() => setVelocityFilter(opt.value)}
                activeOpacity={0.75}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                accessibilityRole="button"
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
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Product list ──────────────────────────────────────────────────── */}
      <FlatList
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
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
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
            <View style={styles.listSectionLabel}>
              <Text style={styles.sectionLabelText}>
                {velocityFilter === 'all' ? 'ALL PRODUCTS' : FILTER_OPTIONS.find((o) => o.value === velocityFilter)?.label.toUpperCase()}
              </Text>
              <Text style={styles.sectionLabelCount}>{filteredProducts.length}</Text>
            </View>
          </Animated.View>
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
          <TouchableOpacity
            onPress={onViewFast}
            style={[bannerStyles.chip, bannerStyles.chipGreen]}
            activeOpacity={0.75}
          >
            <Ionicons name="trending-up" size={13} color="#15803D" />
            <Text style={[bannerStyles.chipText, { color: '#15803D' }]}>
              {fastCount} fast mover{fastCount !== 1 ? 's' : ''} — tap to view
            </Text>
          </TouchableOpacity>
        )}
        {stockoutCount > 0 && (
          <TouchableOpacity
            onPress={onViewStockout}
            style={[bannerStyles.chip, bannerStyles.chipRed]}
            activeOpacity={0.75}
          >
            <Ionicons name="alert-circle" size={13} color="#DC2626" />
            <Text style={[bannerStyles.chipText, { color: '#DC2626' }]}>
              {stockoutCount} item{stockoutCount !== 1 ? 's' : ''} stocking out soon
            </Text>
          </TouchableOpacity>
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
        <TouchableOpacity onPress={onClearSearch} style={emptyStyles.secondaryAction}>
          <Text style={emptyStyles.secondaryActionText}>Clear Search</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onAddProduct}
          style={emptyStyles.primaryAction}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color={Colors.white} />
          <Text style={emptyStyles.primaryActionText}>Add First Product</Text>
        </TouchableOpacity>
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
