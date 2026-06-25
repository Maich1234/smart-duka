import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Text } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { EmptyState } from '@/components/ui/EmptyState';
import { getProducts, type Product, type ProductVariant } from '@/services/products';
import { createSale, getMySales, type Sale } from '@/services/sales';
import { getShopConfig } from '@/services/shop';
import { getPaymentStatus } from '@/services/paymentConfig';
import { ProductCard } from '@/components/inventory/ProductCard';
import { SearchBar } from '@/components/ui/SearchBar';
import { CartItem } from '@/components/sales/CartItem';
import { CartSummary, isValidKenyanPhone } from '@/components/sales/CartSummary';
import { QuantityModal } from '@/components/sales/QuantityModal';
import { VariantPickerModal } from '@/components/sales/VariantPickerModal';
import { SaleCard } from '@/components/sales/SaleCard';
import { SaleDetailsModal } from '@/components/sales/SaleDetailsModal';
import { ReceiptModal } from '@/components/sales/ReceiptModal';
import { MpesaPaymentModal } from '@/components/payments/MpesaPaymentModal';
import { applyBestPromotion } from '@/utils/promotions';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { usePermission } from '@/utils/permissions';
import { Ionicons } from '@expo/vector-icons';

interface CartEntry extends Product {
  cartQuantity: number;
  /** Override for variable/service/configurable lines — undefined means use sellingPrice */
  cartUnitPrice?: number;
  cartVariantId?: string;
  cartVariantName?: string;
}

const cartKey = (item: CartEntry) => `${item._id}:${item.cartVariantId ?? ''}`;

export default function StaffSales() {
  const user = useAuthStore((s: AuthState) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const canRecordSale = usePermission('record_sale');
  const canViewSales = usePermission('view_sales');

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa'>('cash');
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [variantModalVisible, setVariantModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [mpesaModalVisible, setMpesaModalVisible] = useState(false);
  const [pendingMpesaTransactionId, setPendingMpesaTransactionId] = useState<string | null>(null);

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

  const { data: shopConfigData } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });
  const thankYouNote = shopConfigData?.data.receiptThankYouNote;
  const shopLogoUrl = shopConfigData?.data.logoUrl;
  const shopMotto = shopConfigData?.data.motto;

  const { data: paymentStatusData } = useQuery({
    queryKey: ['paymentStatus'],
    queryFn: getPaymentStatus,
    enabled: canRecordSale,
  });
  const mpesaEnabled = paymentStatusData?.data?.mpesa?.isConfigured ?? false;

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
    if (product.productType === 'configurable') {
      if (!product.variants?.length) {
        Alert.alert('No Variants', `${product.name} has no variants configured yet`);
        return;
      }
      setSelectedProduct(product);
      setVariantModalVisible(true);
      return;
    }
    // Bundles carry no stock of their own (their components do) — let the
    // server be authoritative on whether there's enough component stock.
    const tracksOwnStock = product.trackInventory && product.productType !== 'bundle';
    if (tracksOwnStock && product.quantity <= 0) {
      Alert.alert('Out of Stock', `${product.name} is out of stock`);
      return;
    }
    setSelectedProduct(product);
    setQuantityModalVisible(true);
  };

  const confirmAdd = (quantity: number, unitPrice?: number) => {
    if (!selectedProduct) return;
    setCart((prev) => {
      const existing = prev.find((item) => item._id === selectedProduct._id && !item.cartVariantId);
      if (existing) {
        return prev.map((item) =>
          item === existing
            ? { ...item, cartQuantity: item.cartQuantity + quantity, cartUnitPrice: unitPrice ?? item.cartUnitPrice }
            : item
        );
      }
      return [...prev, { ...selectedProduct, cartQuantity: quantity, cartUnitPrice: unitPrice }];
    });
    setQuantityModalVisible(false);
    setSelectedProduct(null);
  };

  const confirmVariantAdd = (variant: ProductVariant, quantity: number) => {
    if (!selectedProduct) return;
    setCart((prev) => {
      const existing = prev.find((item) => item._id === selectedProduct._id && item.cartVariantId === variant._id);
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, cartQuantity: item.cartQuantity + quantity } : item
        );
      }
      return [
        ...prev,
        {
          ...selectedProduct,
          cartQuantity: quantity,
          cartUnitPrice: variant.sellingPrice,
          cartVariantId: variant._id,
          cartVariantName: variant.name,
        },
      ];
    });
    setVariantModalVisible(false);
    setSelectedProduct(null);
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((item) => cartKey(item) !== key));
  };

  const cartPromoResults = cart.map((item) =>
    applyBestPromotion(item.promotions, item.cartQuantity, item.cartUnitPrice ?? item.sellingPrice)
  );
  const totalAmount = cartPromoResults.reduce((sum, r) => sum + r.subtotal, 0);
  const totalSavings = cartPromoResults.reduce((sum, r) => sum + r.discountAmount, 0);

  const buildSaleItems = () => cart.map((item) => ({
    productId: item._id,
    quantity: item.cartQuantity,
    ...((item.productType === 'variable' || item.productType === 'service') && item.cartUnitPrice != null
      ? { unitPrice: item.cartUnitPrice }
      : {}),
    ...(item.cartVariantId ? { variantId: item.cartVariantId } : {}),
  }));

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Add at least one product before checking out.');
      return;
    }
    if (paymentMethod === 'mpesa') {
      if (!mpesaEnabled) {
        Alert.alert('M-Pesa Not Configured', 'The shop owner has not connected an M-Pesa Business account yet.');
        return;
      }
      if (!isValidKenyanPhone(customerPhone)) {
        Alert.alert('Invalid Phone', 'Enter a valid Kenyan number (e.g. +254712345678).');
        return;
      }
      setMpesaModalVisible(true);
      return;
    }
    createSaleMutation.mutate({ items: buildSaleItems(), paymentMethod });
  };

  const handleMpesaSuccess = (transactionId: string) => {
    setMpesaModalVisible(false);
    setPendingMpesaTransactionId(transactionId);
    createSaleMutation.mutate({
      items: buildSaleItems(),
      paymentMethod: 'mpesa',
      mpesaTransactionId: transactionId,
    } as any);
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
          renderItem={({ item, index }) => (
            <SaleCard
              sale={item}
              showStaff={false}
              onPress={() => { setSelectedSale(item); setDetailsModalVisible(true); }}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: tabBarHeight + Spacing.lg }}
          ListEmptyComponent={<EmptyState title="No sales yet" />}
        />
        <SaleDetailsModal
          visible={detailsModalVisible}
          onClose={() => setDetailsModalVisible(false)}
          sale={selectedSale}
          shopName={user?.shop?.name || 'Smart Duka'}
          shopPhone={user?.shop?.phone}
          currency={user?.shop?.currency}
          thankYouNote={thankYouNote}
          logoUrl={shopLogoUrl}
          motto={shopMotto}
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
        renderItem={({ item, index }) => (
          <ProductCard
            product={item}
            showCostPrice={false}
            showActions={false}
            isLast={index === products.length - 1}
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
                  key={cartKey(item)}
                  item={{
                    ...item,
                    quantity: item.cartQuantity,
                    variantName: item.cartVariantName,
                    bundleComponentNames: item.bundleItems?.map(
                      (b) => products.find((p) => p._id === b.product)?.name || 'item'
                    ),
                  }}
                  unitPrice={item.cartUnitPrice}
                  onRemove={() => removeFromCart(cartKey(item))}
                />
              ))}
              <CartSummary
                total={totalAmount}
                totalSavings={totalSavings}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={(m) => { setPaymentMethod(m); if (m === 'cash') setCustomerPhone(''); }}
                onCheckout={handleCheckout}
                loading={createSaleMutation.isPending}
                mpesaEnabled={mpesaEnabled}
                customerPhone={customerPhone}
                onCustomerPhoneChange={setCustomerPhone}
                currency={user?.shop?.currency}
              />
            </View>
          ) : null
        }
        ListFooterComponent={
          canViewSales ? (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>My Sales History</Text>
            {mySales.length === 0 ? (
              <EmptyState title="No sales yet" />
            ) : (
              mySales.map((sale, i) => (
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
        maxStock={
          selectedProduct && selectedProduct.trackInventory && selectedProduct.productType !== 'bundle'
            ? selectedProduct.quantity
            : Infinity
        }
        unitOfMeasure={
          selectedProduct?.productType === 'weighted' || selectedProduct?.productType === 'refillable'
            ? selectedProduct.unitOfMeasure
            : 'unit'
        }
        priceEditable={
          selectedProduct?.productType === 'variable' ||
          (selectedProduct?.productType === 'service' && !!selectedProduct.allowPriceOverride)
        }
        defaultPrice={selectedProduct?.sellingPrice}
        minPrice={selectedProduct?.productType === 'variable' ? selectedProduct.minPrice : undefined}
        maxPrice={selectedProduct?.productType === 'variable' ? selectedProduct.maxPrice : undefined}
      />

      <VariantPickerModal
        visible={variantModalVisible}
        onClose={() => { setVariantModalVisible(false); setSelectedProduct(null); }}
        onConfirm={confirmVariantAdd}
        productName={selectedProduct?.name || ''}
        variants={selectedProduct?.variants || []}
      />

      <SaleDetailsModal
        visible={detailsModalVisible}
        onClose={() => setDetailsModalVisible(false)}
        sale={selectedSale}
        shopName={user?.shop?.name || 'Smart Duka'}
        shopPhone={user?.shop?.phone}
        currency={user?.shop?.currency}
        thankYouNote={thankYouNote}
        logoUrl={shopLogoUrl}
        motto={shopMotto}
      />

      <ReceiptModal
        visible={receiptVisible}
        onClose={() => setReceiptVisible(false)}
        sale={completedSale}
        shopName={user?.shop?.name || 'Smart Duka'}
        shopPhone={user?.shop?.phone}
        currency={user?.shop?.currency}
        servedByName={user?.name}
        thankYouNote={thankYouNote}
        logoUrl={shopLogoUrl}
        motto={shopMotto}
      />

      <MpesaPaymentModal
        visible={mpesaModalVisible}
        phoneNumber={customerPhone}
        amount={totalAmount}
        accountReference={undefined}
        currency={user?.shop?.currency}
        onSuccess={handleMpesaSuccess}
        onCancel={() => setMpesaModalVisible(false)}
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    marginBottom: Spacing.sm,
    color: Colors.textPrimary,
  },
  cartSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sectionTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    marginBottom: Spacing.sm,
    color: Colors.textPrimary,
  },
  historySection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.xl },
});
