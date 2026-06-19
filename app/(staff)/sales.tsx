import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Text } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { getProducts, type Product } from '@/services/products';
import { createSale, getMySales, type Sale } from '@/services/sales';
import { ProductCard } from '@/components/inventory/ProductCard';
import { SearchBar } from '@/components/ui/SearchBar';
import { CartItem } from '@/components/sales/CartItem';
import { CartSummary } from '@/components/sales/CartSummary';
import { QuantityModal } from '@/components/sales/QuantityModal';
import { SaleCard } from '@/components/sales/SaleCard';
import { SaleDetailsModal } from '@/components/sales/SaleDetailsModal';
import { ReceiptModal } from '@/components/sales/ReceiptModal';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { usePermission } from '@/utils/permissions';
import { Ionicons } from '@expo/vector-icons';

interface CartEntry extends Product {
  cartQuantity: number;
}

export default function StaffSales() {
  const user = useAuthStore((s: AuthState) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const canRecordSale = usePermission('record_sale');
  const canViewSales = usePermission('view_sales');

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa'>('cash');
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [receiptVisible, setReceiptVisible] = useState(false);

  const queryClient = useQueryClient();

  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['products', search],
    queryFn: () => getProducts({ search }),
    enabled: canRecordSale,
  });

  const { data: mySalesData } = useQuery({
    queryKey: ['mySales'],
    queryFn: () => getMySales({ limit: 50 }),
    enabled: canViewSales,
  });

  const createSaleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mySales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setCart([]);
      setCompletedSale(data.data);
      setReceiptVisible(true);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Sale failed');
    },
  });

  const products = productsData?.data || [];
  const mySales = mySalesData?.data || [];

  const addToCart = (product: Product) => {
    if (product.quantity === 0) {
      Alert.alert('Out of Stock', `${product.name} is out of stock`);
      return;
    }
    setSelectedProduct(product);
    setQuantityModalVisible(true);
  };

  const confirmAdd = (quantity: number) => {
    if (!selectedProduct) return;
    setCart((prev) => {
      const existing = prev.find((item) => item._id === selectedProduct._id);
      if (existing) {
        return prev.map((item) =>
          item._id === selectedProduct._id
            ? { ...item, cartQuantity: item.cartQuantity + quantity }
            : item
        );
      }
      return [...prev, { ...selectedProduct, cartQuantity: quantity }];
    });
    setQuantityModalVisible(false);
    setSelectedProduct(null);
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item._id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.sellingPrice * item.cartQuantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Add at least one product before checking out.');
      return;
    }
    createSaleMutation.mutate({
      items: cart.map((item) => ({ productId: item._id, quantity: item.cartQuantity })),
      paymentMethod,
    });
  };

  if (!canRecordSale && !canViewSales) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.restrictedText}>You do not have permission to access Sales.</Text>
      </View>
    );
  }

  if (!canRecordSale) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>My Sales History</Text>
        <FlatList
          showsVerticalScrollIndicator={false}
          data={mySales}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <SaleCard sale={item} showStaff={false} onPress={() => { setSelectedSale(item); setDetailsModalVisible(true); }} />
          )}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: tabBarHeight + Spacing.lg }}
          ListEmptyComponent={<Text style={styles.empty}>No sales yet</Text>}
        />
        <SaleDetailsModal
          visible={detailsModalVisible}
          onClose={() => setDetailsModalVisible(false)}
          sale={selectedSale}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record Sale</Text>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search products" />

      <FlatList
        showsVerticalScrollIndicator={false}
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            showCostPrice={false}
            showActions={false}
            onPress={() => addToCart(item)}
          />
        )}
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
        refreshControl={<RefreshControl refreshing={productsLoading} onRefresh={refetchProducts} />}
        ListHeaderComponent={
          cart.length > 0 ? (
            <View style={styles.cartSection}>
              <Text style={styles.sectionTitle}>Current Sale</Text>
              {cart.map((item) => (
                <CartItem
                  key={item._id}
                  item={{ ...item, quantity: item.cartQuantity }}
                  onRemove={() => removeFromCart(item._id)}
                />
              ))}
              <CartSummary
                total={totalAmount}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                onCheckout={handleCheckout}
                loading={createSaleMutation.isPending}
              />
            </View>
          ) : null
        }
        ListFooterComponent={
          canViewSales ? (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>My Sales History</Text>
            {mySales.length === 0 ? (
              <Text style={styles.empty}>No sales yet</Text>
            ) : (
              mySales.map((sale) => (
                <SaleCard
                  key={sale._id}
                  sale={sale}
                  showStaff={false}
                  onPress={() => { setSelectedSale(sale); setDetailsModalVisible(true); }}
                />
              ))
            )}
          </View>
          ) : null
        }
      />

      <QuantityModal
        visible={quantityModalVisible}
        onClose={() => { setQuantityModalVisible(false); setSelectedProduct(null); }}
        onConfirm={confirmAdd}
        productName={selectedProduct?.name || ''}
        maxStock={selectedProduct?.quantity || 0}
      />

      <SaleDetailsModal
        visible={detailsModalVisible}
        onClose={() => setDetailsModalVisible(false)}
        sale={selectedSale}
      />

      <ReceiptModal
        visible={receiptVisible}
        onClose={() => setReceiptVisible(false)}
        sale={completedSale}
        shopName={user?.shop?.name || 'Smart Duka'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.background },
  restrictedText: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: Typography.size.body, textAlign: 'center' },
  title: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    marginBottom: Spacing.sm,
    color: Colors.textPrimary,
  },
  cartSection: {
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    marginBottom: Spacing.sm,
    color: Colors.textPrimary,
  },
  historySection: { paddingHorizontal: Spacing.md, marginBottom: Spacing.xl },
  empty: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: Spacing.md },
});
