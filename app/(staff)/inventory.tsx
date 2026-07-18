import React, { useMemo } from 'react';
import { View, RefreshControl, StyleSheet, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useQuery } from '@tanstack/react-query';
import { getProducts } from '@/services/products';
import { InventoryHeader } from '@/components/inventory/InventoryHeader';
import { ProductCard } from '@/components/inventory/ProductCard';
import { useSearch, localFilter } from '@/hooks/useSearch';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { usePermission } from '@/utils/permissions';

export default function StaffInventory() {
  const tabBarHeight = useBottomTabBarHeight();
  const canViewProducts = usePermission('view_products');

  const {
    value: searchValue,
    query: searchQuery,
    onChange: onSearchChange,
    onSubmit: onSearchSubmit,
    selectRecent,
    recentSearches,
    clearRecent,
  } = useSearch('staff_inventory');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['products', searchQuery],
    queryFn: () => getProducts({ search: searchQuery }),
    enabled: canViewProducts,
  });

  const allProducts = useMemo(() => data?.data || [], [data]);

  const products = useMemo(() => {
    if (!searchQuery) return allProducts;
    return localFilter(allProducts, searchQuery, (p) => [
      p.name,
      p.category,
      ...(p.variants?.map((v) => v.sku).filter(Boolean) ?? []),
    ]);
  }, [allProducts, searchQuery]);

  if (!canViewProducts) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>You do not have permission to view products.</Text>
      </View>
    );
  }

  if (isLoading && allProducts.length === 0) {
    return <ListSkeleton rows={7} showSearch />;
  }

  return (
    <View style={styles.container}>
      <InventoryHeader
        onAddPress={() => {}}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        recentSearches={recentSearches}
        onSelectRecent={selectRecent}
        onClearRecent={clearRecent}
        title="Products"
        showAddButton={false}
        productCount={allProducts.length}
      />
      <FlashList
        showsVerticalScrollIndicator={false}
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ProductCard product={item} showCostPrice={false} showActions={false} />
        )}
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState title="No products found" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: Spacing.xl, color: Colors.textSecondary },
});
