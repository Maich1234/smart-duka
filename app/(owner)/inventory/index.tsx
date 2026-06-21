import React, { useState, useMemo } from 'react';
import { View, FlatList, RefreshControl, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProducts, deleteProduct, updateStock, type Product } from '@/services/products';
import { getDepletionAnalytics } from '@/services/analytics';
import { InventoryHeader } from '@/components/inventory/InventoryHeader';
import { ProductCard } from '@/components/inventory/ProductCard';
import { StockUpdateModal } from '@/components/inventory/StockUpdateModal';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

type VelocityFilter = 'all' | 'fast' | 'slow' | 'stockout';

export default function OwnerInventory() {
  const tabBarHeight = useBottomTabBarHeight();
  const [search, setSearch] = useState('');
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [velocityFilter, setVelocityFilter] = useState<VelocityFilter>('all');
  const queryClient = useQueryClient();

  const { data: depletionData } = useQuery({
    queryKey: ['depletionAnalytics'],
    queryFn: () => getDepletionAnalytics(),
  });
  const depletion = depletionData?.data;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', search],
    queryFn: () => getProducts({ search }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Deletion failed'),
  });

  const stockMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => updateStock(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setStockModalVisible(false);
      Alert.alert('Success', 'Stock updated');
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Stock update failed'),
  });

  const handleDelete = (id: string) => {
    Alert.alert('Confirm', 'Delete product?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
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

  const products = useMemo(() => data?.data || [], [data]);

  const fastIds = useMemo(() => new Set(depletion?.fastMovers.map((i) => i.productId) || []), [depletion]);
  const slowIds = useMemo(() => new Set(depletion?.slowMovers.map((i) => i.productId) || []), [depletion]);
  const stockoutIds = useMemo(() => new Set(depletion?.stockoutSoon.map((i) => i.productId) || []), [depletion]);

  const filteredProducts = useMemo(() => {
    if (velocityFilter === 'fast') return products.filter((p) => fastIds.has(p._id));
    if (velocityFilter === 'slow') return products.filter((p) => slowIds.has(p._id));
    if (velocityFilter === 'stockout') return products.filter((p) => stockoutIds.has(p._id));
    return products;
  }, [products, velocityFilter, fastIds, slowIds, stockoutIds]);

  if (isLoading && products.length === 0) {
    return <LoadingState />;
  }

  return (
    <View style={styles.container}>
      <InventoryHeader onAddPress={() => router.push('/(owner)/inventory/new')} searchValue={search} onSearchChange={setSearch} />

      {depletion && (depletion.fastMovers.length > 0 || depletion.stockoutSoon.length > 0) && (
        <View style={styles.velocityBanner}>
          <Ionicons name="trending-up-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.velocityBannerText}>
            {depletion.fastMovers.length} fast mover{depletion.fastMovers.length === 1 ? '' : 's'}
            {depletion.stockoutSoon.length > 0
              ? ` · ${depletion.stockoutSoon.length} predicted to stock out this week`
              : ''}
          </Text>
        </View>
      )}

      <View style={styles.filterRow}>
        {([
          { value: 'all', label: 'All' },
          { value: 'fast', label: `Fast movers (${fastIds.size})` },
          { value: 'slow', label: `Slow movers (${slowIds.size})` },
          { value: 'stockout', label: `Stockout soon (${stockoutIds.size})` },
        ] as { value: VelocityFilter; label: string }[]).map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.filterChip, velocityFilter === opt.value && styles.filterChipActive]}
            onPress={() => setVelocityFilter(opt.value)}
          >
            <Text style={[styles.filterChipText, velocityFilter === opt.value && styles.filterChipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        data={filteredProducts}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            showCostPrice
            showActions
            onPress={() => router.push(`/(owner)/inventory/${item._id}/edit`)}
            onEdit={() => router.push(`/(owner)/inventory/${item._id}/edit`)}
            onDelete={() => handleDelete(item._id)}
            onUpdateStock={() => openStockModal(item)}
          />
        )}
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState title="No products found" subtitle="Add your first product to start tracking stock." />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  velocityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
  },
  velocityBannerText: { fontSize: Typography.size.small, color: Colors.textSecondary, flex: 1 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  filterChip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: Typography.size.caption, color: Colors.textSecondary, fontFamily: Typography.fontFamilySemiBold },
  filterChipTextActive: { color: Colors.white },
});
