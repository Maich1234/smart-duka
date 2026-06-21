import React, { useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import { getProducts } from '@/services/products';
import { InventoryHeader } from '@/components/inventory/InventoryHeader';
import { ProductCard } from '@/components/inventory/ProductCard';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { usePermission } from '@/utils/permissions';

export default function StaffInventory() {
  const tabBarHeight = useBottomTabBarHeight();
  const [search, setSearch] = useState('');
  const canViewProducts = usePermission('view_products');
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', search],
    queryFn: () => getProducts({ search }),
    enabled: canViewProducts,
  });

  const products = data?.data || [];

  if (!canViewProducts) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>You do not have permission to view products.</Text>
      </View>
    );
  }

  if (isLoading && products.length === 0) {
    return <LoadingState />;
  }

  return (
    <View style={styles.container}>
      <InventoryHeader onAddPress={() => {}} searchValue={search} onSearchChange={setSearch} title="Products" showAddButton={false} />
      <FlatList
        showsVerticalScrollIndicator={false}
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ProductCard product={item} showCostPrice={false} showActions={false} />
        )}
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
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
