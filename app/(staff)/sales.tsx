import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Text, BackHandler } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useFocusEffect, useNavigation } from "expo-router/react-navigation";
import { useAlert } from '@/context/AlertContext';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { EmptyState } from '@/components/ui/EmptyState';
import { getProducts, type Product, type ProductVariant } from '@/services/products';
import { createSale, getMySales, voidSale, type Sale } from '@/services/sales';
import { getShopConfig } from '@/services/shop';
import { getPaymentStatus } from '@/services/paymentConfig';
import { ProductCard } from '@/components/inventory/ProductCard';
import { ContextualSearchBar } from '@/components/ui/ContextualSearchBar';
import { useSearch } from '@/hooks/useSearch';
import { CartItem } from '@/components/sales/CartItem';
import { CartSummary, isValidKenyanPhone } from '@/components/sales/CartSummary';
import { QuantityModal } from '@/components/sales/QuantityModal';
import { VariantPickerModal } from '@/components/sales/VariantPickerModal';
import { SaleCard } from '@/components/sales/SaleCard';
import { SaleDetailsModal } from '@/components/sales/SaleDetailsModal';
import { ReceiptModal } from '@/components/sales/ReceiptModal';
import { MpesaPaymentModal } from '@/components/payments/MpesaPaymentModal';
import { applyBestPromotion } from '@/utils/promotions';
import { isOfflineQueued } from '@/utils/errors';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { usePermission } from '@/utils/permissions';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCartStore, cartKey, type CartEntry } from '@/store/staffCartStore';

export default function StaffSales() {
  const user = useAuthStore((s: AuthState) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const canRecordSale = usePermission('record_sale');
  const canViewSales = usePermission('view_sales');
  const canVoidSale = usePermission('void_sale');
  const { toast, alert } = useAlert();

  const {
    value: search,
    query: searchQuery,
    onChange: setSearch,
    onSubmit: onSearchSubmit,
    selectRecent: selectProductRecent,
    recentSearches: productRecentSearches,
    clearRecent: clearProductRecentSearches,
  } = useSearch('pos_products');

  const { cart, addItem, removeItem, clearCart, updateItem } = useCartStore();
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
  const [mpesaMode, setMpesaMode] = useState<'stk' | 'manual'>('stk');
  const [manualReceiptCode, setManualReceiptCode] = useState('');

  const queryClient = useQueryClient();
  const navigation = useNavigation();

  const [productsPage, setProductsPage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);

  // Reset to page 1 whenever the search query changes so stale page numbers
  // don't produce empty results when the new query has fewer pages.
  useEffect(() => {
    setProductsPage(1);
  }, [searchQuery]);

  // Block tab navigation mid-sale — confirm before discarding the cart.
  useEffect(() => {
    const unsubscribe = (navigation as any).addListener('tabPress', (e: any) => {
      if (cart.length === 0) return;
      e.preventDefault();
      const targetAction = e.data?.action;
      alert({
        type: 'confirm',
        title: 'Leave Sale?',
        message: 'You have items in your cart. Leaving this screen will clear your current sale.',
        buttons: [
          { label: 'Stay', variant: 'ghost' },
          {
            label: 'Leave',
            variant: 'danger',
            onPress: () => {
              clearCart();
              setCustomerPhone('');
              setMpesaMode('stk');
              setManualReceiptCode('');
              if (targetAction) (navigation as any).dispatch(targetAction);
            },
          },
        ],
      });
    });
    return unsubscribe;
  }, [navigation, cart.length, alert, clearCart]);

  // Intercept Android back button when mid-sale to prevent silent cart loss.
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (cart.length === 0) return false;
        alert({
          type: 'confirm',
          title: 'Discard Sale?',
          message: 'You have items in your cart. Going back will clear your current sale.',
          buttons: [
            { label: 'Stay', variant: 'ghost' },
            {
              label: 'Discard',
              variant: 'danger',
              onPress: () => {
                clearCart();
                setCustomerPhone('');
                setMpesaMode('stk');
                setManualReceiptCode('');
              },
            },
          ],
        });
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [cart.length, alert, clearCart])
  );

  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['products', searchQuery, productsPage],
    queryFn: () => getProducts({ search: searchQuery, page: productsPage, limit: 10 }),
    enabled: canRecordSale,
  });

  const { data: mySalesData } = useQuery({
    queryKey: ['mySales', salesPage],
    queryFn: () => getMySales({ page: salesPage, limit: 10 }),
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
      clearCart();
      setManualReceiptCode('');
      setMpesaMode('stk');
      setCompletedSale(data.data);
      setReceiptVisible(true);
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        clearCart();
        setManualReceiptCode('');
        setMpesaMode('stk');
        toast({ type: 'info', message: 'Sale saved offline — will sync when connected.' });
        return;
      }
      toast({ type: 'error', message: error.response?.data?.message || 'Sale failed' });
    },
  });

  const voidMutation = useMutation({
    mutationFn: (saleId: string) => voidSale(saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // stock restored
      setDetailsModalVisible(false);
      toast({ type: 'success', message: 'Sale voided — stock restored.' });
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        setDetailsModalVisible(false);
        toast({ type: 'info', message: 'Void saved offline — will sync when connected.' });
        return;
      }
      toast({ type: 'error', message: error.response?.data?.message || 'Could not void this sale.' });
    },
  });

  const handleVoid = (sale: Sale) => {
    alert({
      type: 'confirm',
      title: 'Void This Sale?',
      message: `${sale.invoiceNumber} will be removed from totals and its stock restored. This cannot be undone.`,
      buttons: [
        { label: 'Keep Sale', variant: 'ghost' },
        { label: 'Void Sale', variant: 'danger', onPress: () => voidMutation.mutate(sale._id) },
      ],
    });
  };

  const products = productsData?.data || [];
  const mySales = mySalesData?.data || [];
  const productsTotalPages = productsData?.pagination?.pages ?? 1;
  const salesTotalPages = mySalesData?.pagination?.pages ?? 1;

  const addToCart = (product: Product) => {
    if (product.productType === 'configurable') {
      if (!product.variants?.length) {
        toast({ type: 'warning', message: `${product.name} has no variants configured yet` });
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
      toast({ type: 'warning', message: `${product.name} is out of stock` });
      return;
    }
    setSelectedProduct(product);
    setQuantityModalVisible(true);
  };

  const confirmAdd = (quantity: number, unitPrice?: number) => {
    if (!selectedProduct) return;
    const existing = cart.find((item) => item._id === selectedProduct._id && !item.cartVariantId);
    if (existing) {
      updateItem(cartKey(existing), {
        cartQuantity: existing.cartQuantity + quantity,
        cartUnitPrice: unitPrice ?? existing.cartUnitPrice,
      });
    } else {
      addItem({ ...selectedProduct, cartQuantity: quantity, cartUnitPrice: unitPrice });
    }
    setQuantityModalVisible(false);
    setSelectedProduct(null);
  };

  const confirmVariantAdd = (variant: ProductVariant, quantity: number) => {
    if (!selectedProduct) return;
    const existing = cart.find(
      (item) => item._id === selectedProduct._id && item.cartVariantId === variant._id
    );
    if (existing) {
      updateItem(cartKey(existing), { cartQuantity: existing.cartQuantity + quantity });
    } else {
      addItem({
        ...selectedProduct,
        cartQuantity: quantity,
        cartUnitPrice: variant.sellingPrice,
        cartVariantId: variant._id,
        cartVariantName: variant.name,
      });
    }
    setVariantModalVisible(false);
    setSelectedProduct(null);
  };

  const removeFromCart = (key: string) => {
    removeItem(key);
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
      toast({ type: 'warning', message: 'Add at least one product before checking out.' });
      return;
    }
    if (paymentMethod === 'mpesa') {
      if (mpesaMode === 'manual') {
        // Customer already paid — skip STK push, record receipt directly.
        const code = manualReceiptCode.trim();
        if (code.length < 6) {
          toast({ type: 'error', message: 'Enter a valid M-Pesa receipt code.' });
          return;
        }
        createSaleMutation.mutate({
          items: buildSaleItems(),
          paymentMethod: 'mpesa',
          mpesaReceiptNumber: code,
        });
        return;
      }
      // STK push flow
      if (!mpesaEnabled) {
        toast({ type: 'warning', message: 'The shop owner has not connected an M-Pesa Business account yet.' });
        return;
      }
      if (!isValidKenyanPhone(customerPhone)) {
        toast({ type: 'error', message: 'Enter a valid Kenyan number (e.g. +254712345678).' });
        return;
      }
      setMpesaModalVisible(true);
      return;
    }
    createSaleMutation.mutate({ items: buildSaleItems(), paymentMethod });
  };

  const handleMpesaSuccess = (transactionId: string | null, receiptNumber: string | null) => {
    setMpesaModalVisible(false);
    createSaleMutation.mutate({
      items: buildSaleItems(),
      paymentMethod: 'mpesa',
      // Normal flow: link confirmed STK push transaction
      // Offline flow: no transactionId — pass receipt number for the backend to record
      ...(transactionId
        ? { mpesaTransactionId: transactionId }
        : { mpesaReceiptNumber: receiptNumber ?? undefined }),
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
          renderItem={({ item, index }) => (
            <SaleCard
              sale={item}
              showStaff={false}
              onPress={() => { setSelectedSale(item); setDetailsModalVisible(true); }}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: tabBarHeight + Spacing.lg }}
          ListEmptyComponent={<EmptyState title="No sales yet" />}
          ListFooterComponent={
            salesTotalPages > 1 ? (
              <View style={salesPaginationStyle}>
                <AnimatedPressable onPress={() => setSalesPage((p) => Math.max(1, p - 1))} disabled={salesPage <= 1} style={[pageBtn, salesPage <= 1 && pageBtnDisabled]}>
                  <Ionicons name="chevron-back" size={16} color={salesPage <= 1 ? '#94A3B8' : '#0F766E'} />
                </AnimatedPressable>
                <Text style={pageLabelStyle}>Page {salesPage} of {salesTotalPages}</Text>
                <AnimatedPressable onPress={() => setSalesPage((p) => Math.min(salesTotalPages, p + 1))} disabled={salesPage >= salesTotalPages} style={[pageBtn, salesPage >= salesTotalPages && pageBtnDisabled]}>
                  <Ionicons name="chevron-forward" size={16} color={salesPage >= salesTotalPages ? '#94A3B8' : '#0F766E'} />
                </AnimatedPressable>
              </View>
            ) : null
          }
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
          canVoid={canVoidSale}
          onVoid={handleVoid}
          voiding={voidMutation.isPending}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record Sale</Text>
      <ContextualSearchBar
        value={search}
        onChangeText={setSearch}
        onSubmit={onSearchSubmit}
        recentSearches={productRecentSearches}
        onSelectRecent={selectProductRecent}
        onClearRecent={clearProductRecentSearches}
        placeholder="Search products…"
        style={styles.searchBar}
      />

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
          <View>
            {cart.length > 0 && (
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
                  onPaymentMethodChange={(m) => {
                    setPaymentMethod(m);
                    if (m === 'cash') {
                      setCustomerPhone('');
                      setMpesaMode('stk');
                      setManualReceiptCode('');
                    }
                  }}
                  onCheckout={handleCheckout}
                  loading={createSaleMutation.isPending}
                  mpesaEnabled={mpesaEnabled}
                  customerPhone={customerPhone}
                  onCustomerPhoneChange={setCustomerPhone}
                  currency={user?.shop?.currency}
                  mpesaMode={mpesaMode}
                  onMpesaModeChange={setMpesaMode}
                  manualReceiptCode={manualReceiptCode}
                  onManualReceiptCodeChange={setManualReceiptCode}
                />
              </View>
            )}
            {/* Product pagination sits above the product list so staff never
                need to scroll past products to change pages. */}
            {productsTotalPages > 1 && (
              <View style={[styles.paginationRow, styles.productsPaginationHeader]}>
                <AnimatedPressable
                  onPress={() => setProductsPage((p) => Math.max(1, p - 1))}
                  disabled={productsPage <= 1}
                  style={[styles.paginationBtn, productsPage <= 1 && styles.paginationBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel={`Previous page, page ${productsPage - 1}`}
                  accessibilityState={{ disabled: productsPage <= 1 }}
                >
                  <Ionicons name="chevron-back" size={16} color={productsPage <= 1 ? Colors.textSecondary : Colors.primary} />
                </AnimatedPressable>
                <Text style={styles.paginationLabel}>Page {productsPage} of {productsTotalPages}</Text>
                <AnimatedPressable
                  onPress={() => setProductsPage((p) => Math.min(productsTotalPages, p + 1))}
                  disabled={productsPage >= productsTotalPages}
                  style={[styles.paginationBtn, productsPage >= productsTotalPages && styles.paginationBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel={`Next page, page ${productsPage + 1}`}
                  accessibilityState={{ disabled: productsPage >= productsTotalPages }}
                >
                  <Ionicons name="chevron-forward" size={16} color={productsPage >= productsTotalPages ? Colors.textSecondary : Colors.primary} />
                </AnimatedPressable>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          <View>
            {/* Sales history — map() inside a FlatList footer loses virtualisation,
                acceptable here because the server pages to ≤10 items. If the page
                limit is ever removed, move this section to a separate screen/tab. */}
            {canViewSales && (
              <View style={styles.historySection}>
                <Text style={styles.sectionTitle}>My Sales History</Text>
                {mySales.length === 0 ? (
                  <EmptyState title="No sales yet" />
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
                {salesTotalPages > 1 && (
                  <View style={styles.paginationRow}>
                    <AnimatedPressable
                      onPress={() => setSalesPage((p) => Math.max(1, p - 1))}
                      disabled={salesPage <= 1}
                      style={[styles.paginationBtn, salesPage <= 1 && styles.paginationBtnDisabled]}
                      accessibilityRole="button"
                      accessibilityLabel={`Previous page, page ${salesPage - 1}`}
                      accessibilityState={{ disabled: salesPage <= 1 }}
                    >
                      <Ionicons name="chevron-back" size={16} color={salesPage <= 1 ? Colors.textSecondary : Colors.primary} />
                    </AnimatedPressable>
                    <Text style={styles.paginationLabel}>Page {salesPage} of {salesTotalPages}</Text>
                    <AnimatedPressable
                      onPress={() => setSalesPage((p) => Math.min(salesTotalPages, p + 1))}
                      disabled={salesPage >= salesTotalPages}
                      style={[styles.paginationBtn, salesPage >= salesTotalPages && styles.paginationBtnDisabled]}
                      accessibilityRole="button"
                      accessibilityLabel={`Next page, page ${salesPage + 1}`}
                      accessibilityState={{ disabled: salesPage >= salesTotalPages }}
                    >
                      <Ionicons name="chevron-forward" size={16} color={salesPage >= salesTotalPages ? Colors.textSecondary : Colors.primary} />
                    </AnimatedPressable>
                  </View>
                )}
              </View>
            )}
          </View>
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
        canVoid={canVoidSale}
        onVoid={handleVoid}
        voiding={voidMutation.isPending}
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
  searchBar: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
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
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: Spacing.md,
  },
  productsPaginationHeader: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  paginationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationBtnDisabled: {
    borderColor: Colors.border,
  },
  paginationLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
});

// Inline styles used only in the read-only sales history branch
const salesPaginationStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 20, paddingVertical: Spacing.md };
const pageBtn = { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#0F766E', alignItems: 'center' as const, justifyContent: 'center' as const };
const pageBtnDisabled = { borderColor: '#CBD5E1' };
const pageLabelStyle = { fontSize: 13, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary };
