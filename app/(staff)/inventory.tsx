import React, { useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getProducts } from '@/services/products';
import { InventoryHeader } from '@/components/inventory/InventoryHeader';
import { ProductCard } from '@/components/inventory/ProductCard';
import { Colors } from '@/constants/Colors';

export default function StaffInventory() {
  const [search, setSearch] = useState('');
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', search],
    queryFn: () => getProducts({ search }),
  });

  const products = data?.data || [];

  if (isLoading && products.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <InventoryHeader onAddPress={() => {}} searchValue={search} onSearchChange={setSearch} title="Products" />
      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ProductCard product={item} showCostPrice={false} showActions={false} />
        )}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>No products found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 40, color: Colors.textSecondary },
});
