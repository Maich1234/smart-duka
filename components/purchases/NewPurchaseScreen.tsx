import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useNavigation } from 'expo-router/react-navigation';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAlert } from '@/context/AlertContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { purchasingBasePath } from '@/utils/purchasingRoutes';
import { EmptyState } from '@/components/ui/EmptyState';
import { getProducts, type Product } from '@/services/products';
import { createPurchase, type CreatePurchaseData, type PurchaseCostCategory } from '@/services/purchases';
import { ProductCard } from '@/components/inventory/ProductCard';
import { ContextualSearchBar } from '@/components/ui/ContextualSearchBar';
import { useSearch } from '@/hooks/useSearch';
import {
  usePurchaseCartStore,
  purchaseCartKey,
  type PurchaseCartEntry,
} from '@/store/purchaseCartStore';
import { ProductEntrySheet, type ProductEntryLine } from '@/components/purchases/ProductEntrySheet';
import { PurchaseCartItem } from '@/components/purchases/PurchaseCartItem';
import { AdditionalCostsCard } from '@/components/purchases/AdditionalCostsCard';
import { PurchaseSummaryBar } from '@/components/purchases/PurchaseSummaryBar';
import { SupplierPickerSheet } from '@/components/purchases/SupplierPickerSheet';
import { PurchaseConfirmationSheet } from '@/components/purchases/PurchaseConfirmationSheet';
import { isOfflineQueued } from '@/utils/errors';
import { randomUUID } from '@/utils/uuid';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/** Bundles/services carry no purchasable stock of their own — hidden from the picker. */
const EXCLUDE_TYPES = 'bundle,service';

export function NewPurchaseScreen() {
  const role = useAuthStore((s: AuthState) => s.user?.role);
  const userName = useAuthStore((s: AuthState) => s.user?.name) ?? 'You';
  const base = purchasingBasePath(role);
  const canCreate = usePermission('create_purchases');
  const { toast, alert } = useAlert();
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  const {
    supplier, items, additionalCosts,
    setSupplier, addItem, updateItem, removeItem,
    addCost, updateCost, removeCost, clear,
  } = usePurchaseCartStore();

  const [supplierSheetVisible, setSupplierSheetVisible] = useState(false);
  const [entrySheetVisible, setEntrySheetVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PurchaseCartEntry | Product | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const {
    value: search, query: searchQuery, onChange: setSearch, onSubmit: onSearchSubmit,
    selectRecent, recentSearches, clearRecent,
  } = useSearch('purchase_products');

  const [productsPage, setProductsPage] = useState(1);
  useEffect(() => setProductsPage(1), [searchQuery]);

  const { data: productsData, refetch: refetchProducts } = useQuery({
    queryKey: ['products', searchQuery, productsPage, EXCLUDE_TYPES],
    queryFn: () => getProducts({ search: searchQuery, page: productsPage, limit: 10, excludeTypes: EXCLUDE_TYPES }),
    enabled: canCreate,
  });
  // Server already hides bundle/service; this only catches the rarer
  // untracked-inventory case, which isn't a distinct productType to filter on.
  const products = (productsData?.data ?? []).filter((p) => p.trackInventory !== false);
  const productsTotalPages = productsData?.pagination?.pages ?? 1;

  const [pullRefreshing, setPullRefreshing] = useState(false);
  const onPullRefresh = async () => {
    setPullRefreshing(true);
    try {
      await refetchProducts();
    } finally {
      setPullRefreshing(false);
    }
  };

  // Guard against losing an in-progress purchase — fires on the header back
  // button, Android hardware back, and any programmatic pop of this screen.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (items.length === 0 && !supplier) return;
      e.preventDefault();
      alert({
        type: 'confirm',
        title: 'Discard Purchase?',
        message: 'You have products in this purchase. Leaving now will discard everything you\'ve entered.',
        buttons: [
          { label: 'Stay', variant: 'ghost' },
          {
            label: 'Discard',
            variant: 'danger',
            onPress: () => {
              clear();
              navigation.dispatch(e.data.action);
            },
          },
        ],
      });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, items.length, supplier, clear]);

  const createMutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseStats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      clear();
      setConfirmVisible(false);
      toast({ type: 'success', message: data.message || 'Purchase recorded and stock updated.' });
      router.replace(base as never);
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        clear();
        setConfirmVisible(false);
        toast({ type: 'info', message: 'Purchase saved offline — will sync when connected.' });
        router.replace(base as never);
        return;
      }
      toast({ type: 'error', message: error.response?.data?.message || 'Could not save this purchase.' });
    },
  });

  const handleProductPress = (product: Product) => {
    if (product.productType === 'configurable' && !product.variants?.length) {
      toast({ type: 'warning', message: `${product.name} has no variants configured yet` });
      return;
    }
    setSelectedProduct(product);
    setEditingKey(null);
    setEntrySheetVisible(true);
  };

  const handleEditCartItem = (item: PurchaseCartEntry) => {
    setSelectedProduct(item);
    setEditingKey(purchaseCartKey(item));
    setEntrySheetVisible(true);
  };

  const closeEntrySheet = () => {
    setEntrySheetVisible(false);
    setSelectedProduct(null);
    setEditingKey(null);
  };

  const handleEntryConfirm = (line: ProductEntryLine) => {
    if (!selectedProduct) return;
    const key = `${selectedProduct._id}:${line.variantId ?? ''}`;

    if (editingKey) {
      updateItem(editingKey, {
        cartQuantity: line.quantity,
        cartUnitCost: line.unitCost,
        cartTotalCost: line.totalCost,
        cartVariantId: line.variantId,
        cartVariantName: line.variantName,
      });
      closeEntrySheet();
      return;
    }

    // Re-adding a product/variant already in the cart edits that line in
    // place instead of creating a confusing duplicate row.
    const existing = items.find((i) => purchaseCartKey(i) === key);
    if (existing) {
      updateItem(key, {
        cartQuantity: line.quantity,
        cartUnitCost: line.unitCost,
        cartTotalCost: line.totalCost,
        cartVariantId: line.variantId,
        cartVariantName: line.variantName,
      });
    } else {
      addItem({
        ...(selectedProduct as Product),
        cartQuantity: line.quantity,
        cartUnitCost: line.unitCost,
        cartTotalCost: line.totalCost,
        cartVariantId: line.variantId,
        cartVariantName: line.variantName,
      });
    }
    closeEntrySheet();
  };

  const productsTotal = items.reduce((sum, i) => sum + i.cartTotalCost, 0);
  const additionalCostsTotal = additionalCosts.reduce((sum, c) => sum + c.amount, 0);
  const grandTotal = productsTotal + additionalCostsTotal;
  const totalQuantity = items.reduce((sum, i) => sum + i.cartQuantity, 0);

  const buildPayload = (): CreatePurchaseData => ({
    ...(supplier?.supplierId ? { supplierId: supplier.supplierId } : {}),
    ...(supplier?.supplierName ? { supplierName: supplier.supplierName } : {}),
    items: items.map((i) => ({
      productId: i._id,
      quantity: i.cartQuantity,
      unitCost: i.cartUnitCost,
      ...(i.cartVariantId ? { variantId: i.cartVariantId } : {}),
    })),
    additionalCosts: additionalCosts.map((c) => ({
      category: c.category as PurchaseCostCategory,
      ...(c.description ? { description: c.description } : {}),
      amount: c.amount,
      ...(c.notes ? { notes: c.notes } : {}),
    })),
  });

  const handleConfirmSave = () => {
    createMutation.mutate(buildPayload());
  };

  if (!canCreate) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.restrictedText}>You do not have permission to create purchases.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AnimatedPressable style={styles.supplierRow} onPress={() => setSupplierSheetVisible(true)}>
        <View style={styles.supplierIconWrap}>
          <Ionicons name="business-outline" size={16} color={Colors.primary} />
        </View>
        <View style={styles.supplierText}>
          <Text style={styles.supplierLabel}>Supplier</Text>
          <Text style={styles.supplierValue} numberOfLines={1}>
            {supplier ? supplier.supplierName : 'No supplier selected'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </AnimatedPressable>

      <ContextualSearchBar
        value={search}
        onChangeText={setSearch}
        onSubmit={onSearchSubmit}
        recentSearches={recentSearches}
        onSelectRecent={selectRecent}
        onClearRecent={clearRecent}
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
            showCostPrice
            showActions={false}
            isLast={index === products.length - 1}
            onPress={() => handleProductPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={onPullRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState title="No products found" subtitle="Try a different search term." />}
        ListHeaderComponent={
          <View>
            {items.length > 0 && (
              <View style={styles.cartSection}>
                <Text style={styles.sectionTitle}>Products in this Purchase</Text>
                {items.map((item) => (
                  <PurchaseCartItem
                    key={purchaseCartKey(item)}
                    item={item}
                    onEdit={() => handleEditCartItem(item)}
                    onRemove={() => removeItem(purchaseCartKey(item))}
                  />
                ))}
              </View>
            )}

            {items.length > 0 && (
              <AdditionalCostsCard
                costs={additionalCosts}
                onAdd={(cost) => addCost({ ...cost, key: randomUUID() })}
                onUpdate={(key, cost) => updateCost(key, cost)}
                onRemove={(key) => removeCost(key)}
              />
            )}

            {items.length > 0 && (
              <PurchaseSummaryBar
                productsTotal={productsTotal}
                additionalCostsTotal={additionalCostsTotal}
                grandTotal={grandTotal}
                totalQuantity={totalQuantity}
                onReview={() => setConfirmVisible(true)}
              />
            )}

            {productsTotalPages > 1 && (
              <View style={styles.paginationRow}>
                <AnimatedPressable
                  onPress={() => setProductsPage((p) => Math.max(1, p - 1))}
                  disabled={productsPage <= 1}
                  style={[styles.paginationBtn, productsPage <= 1 && styles.paginationBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                >
                  <Ionicons name="chevron-back" size={16} color={productsPage <= 1 ? Colors.textSecondary : Colors.primary} />
                </AnimatedPressable>
                <Text style={styles.paginationLabel}>Page {productsPage} of {productsTotalPages}</Text>
                <AnimatedPressable
                  onPress={() => setProductsPage((p) => Math.min(productsTotalPages, p + 1))}
                  disabled={productsPage >= productsTotalPages}
                  style={[styles.paginationBtn, productsPage >= productsTotalPages && styles.paginationBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                >
                  <Ionicons name="chevron-forward" size={16} color={productsPage >= productsTotalPages ? Colors.textSecondary : Colors.primary} />
                </AnimatedPressable>
              </View>
            )}
          </View>
        }
      />

      <SupplierPickerSheet
        visible={supplierSheetVisible}
        onClose={() => setSupplierSheetVisible(false)}
        onSelect={(selection) => setSupplier(selection)}
      />

      <ProductEntrySheet
        visible={entrySheetVisible}
        onClose={closeEntrySheet}
        onConfirm={handleEntryConfirm}
        product={selectedProduct}
        initial={
          editingKey && selectedProduct && 'cartQuantity' in selectedProduct
            ? {
                quantity: (selectedProduct as PurchaseCartEntry).cartQuantity,
                unitCost: (selectedProduct as PurchaseCartEntry).cartUnitCost,
                totalCost: (selectedProduct as PurchaseCartEntry).cartTotalCost,
                variantId: (selectedProduct as PurchaseCartEntry).cartVariantId,
              }
            : undefined
        }
      />

      <PurchaseConfirmationSheet
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={handleConfirmSave}
        loading={createMutation.isPending}
        supplierName={supplier?.supplierName ?? ''}
        productCount={items.length}
        totalQuantity={totalQuantity}
        grandTotal={grandTotal}
        staffName={userName}
        date={new Date()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.background },
  restrictedText: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: Typography.size.body, textAlign: 'center' },

  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  supplierIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center' },
  supplierText: { flex: 1 },
  supplierLabel: { fontSize: Typography.size.caption, color: Colors.textSecondary },
  supplierValue: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, marginTop: 1 },

  searchBar: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },

  listContent: { paddingBottom: Spacing.xl },

  cartSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sectionTitle: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, marginBottom: Spacing.sm, color: Colors.textPrimary },

  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: Spacing.md, marginHorizontal: Spacing.lg },
  paginationBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  paginationBtnDisabled: { borderColor: Colors.border },
  paginationLabel: { fontSize: 13, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary },
});
