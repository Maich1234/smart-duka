import React, { useState } from 'react';
import { View, FlatList, RefreshControl, Alert, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, createProduct, updateProduct, deleteProduct, updateStock } from '@/services/products';
import { InventoryHeader } from '@/components/inventory/InventoryHeader';
import { ProductCard } from '@/components/inventory/ProductCard';
import { ProductFormModal } from '@/components/inventory/ProductFormModal';
import { StockUpdateModal } from '@/components/inventory/StockUpdateModal';
import { Colors } from '@/constants/Colors';

export default function OwnerInventory() {
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedProductForStock, setSelectedProductForStock] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', category: '', sellingPrice: '', costPrice: '', quantity: '', lowStockAlert: '5',
  });
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', search],
    queryFn: () => getProducts({ search }),
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); closeModal(); },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Creation failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateProduct(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); closeModal(); },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Update failed'),
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

  const openModal = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setForm({
        name: product.name,
        category: product.category,
        sellingPrice: String(product.sellingPrice),
        costPrice: String(product.costPrice),
        quantity: String(product.quantity),
        lowStockAlert: String(product.lowStockAlert),
      });
    } else {
      setEditingProduct(null);
      setForm({ name: '', category: '', sellingPrice: '', costPrice: '', quantity: '', lowStockAlert: '5' });
    }
    setModalVisible(true);
  };

  const closeModal = () => setModalVisible(false);

  const handleSave = () => {
    if (!form.name || !form.category || !form.sellingPrice || !form.costPrice) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    const payload = {
      name: form.name,
      category: form.category.toLowerCase(),
      sellingPrice: parseFloat(form.sellingPrice),
      costPrice: parseFloat(form.costPrice),
      quantity: parseInt(form.quantity) || 0,
      lowStockAlert: parseInt(form.lowStockAlert) || 5,
    };
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Confirm', 'Delete product?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const openStockModal = (product: any) => {
    setSelectedProductForStock(product);
    setStockModalVisible(true);
  };

  const handleStockUpdate = (quantity: number) => {
    if (selectedProductForStock) {
      stockMutation.mutate({ id: selectedProductForStock._id, quantity });
    }
  };

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
      <InventoryHeader onAddPress={() => openModal()} searchValue={search} onSearchChange={setSearch} />
      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            showCostPrice
            showActions
            onPress={() => openModal(item)}
            onEdit={() => openModal(item)}
            onDelete={() => handleDelete(item._id)}
            onUpdateStock={() => openStockModal(item)}
          />
        )}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>No products found</Text>
          </View>
        }
      />

      <ProductFormModal
        visible={modalVisible}
        onClose={closeModal}
        onSave={handleSave}
        form={form}
        setForm={setForm}
        isEditing={!!editingProduct}
        loading={createMutation.isPending || updateMutation.isPending}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 40, color: Colors.textSecondary },
});
