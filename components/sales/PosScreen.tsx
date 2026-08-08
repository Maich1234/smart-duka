import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Text, BackHandler } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useFocusEffect, useNavigation } from "expo-router/react-navigation";
import { router } from 'expo-router';
import { useAlert } from '@/context/AlertContext';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { EmptyState } from '@/components/ui/EmptyState';
import { getProducts, type Product, type ProductVariant } from '@/services/products';
import { createSale, getMySales, voidSale, refundSale, type Sale } from '@/services/sales';
import { getShopConfig } from '@/services/shop';
import { getPaymentStatus } from '@/services/paymentConfig';
import { getTransactionStatus } from '@/services/mpesa';
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
import { ShiftGate, ActiveShiftBar } from '@/components/shifts/ShiftGate';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { applyBestPromotion } from '@/utils/promotions';
import { formatCurrency } from '@/utils/formatters';
import { isOfflineQueued, isOfflineUnavailable, mutationErrorMessage } from '@/utils/errors';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { usePermission } from '@/utils/permissions';
import {
  CASH_METHOD_KEY,
  MPESA_METHOD_KEY,
  resolveSaleMethods,
} from '@/constants/paymentMethods';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCartStore, cartKey } from '@/store/staffCartStore';
import { usePendingMpesaStore, type PendingMpesaPayment } from '@/store/pendingMpesaStore';
import { isOfflineDbAvailable } from '@/utils/offlineDb';
import { syncProductCache, searchCachedProducts, applyOfflineStockDelta, PRODUCT_CACHE_STALE_MS } from '@/utils/productCache';
import { addOrIncrementCartItem } from '@/utils/cartOperations';

// How long the background watcher (below) keeps quietly re-checking a
// payment the cashier cancelled out of while it was still pending, and how
// often. Capped rather than indefinite — a payment the customer genuinely
// never completes shouldn't be polled for the rest of an open-ended shift;
// past this window it falls back to the banner's manual "Check" and to the
// next app-restart recovery pass.
const BACKGROUND_WATCH_INTERVAL_MS = 10000;
const MAX_BACKGROUND_WATCH_MS = 5 * 60 * 1000;

/**
 * The till. Product search, cart, payment (cash / M-Pesa), receipt, and the
 * seller's own recent sales.
 *
 * Role-agnostic on purpose. It was originally the staff-only sales screen,
 * which left owner-operated dukas — most of them — with no way to record a
 * sale at all: the owner's "New Sale" button led to a read-only history
 * screen. Every capability check here goes through usePermission, and owners
 * implicitly hold every permission, so the same component serves both
 * /(staff)/sales and /(owner)/pos without branching on role.
 */
interface PosScreenProps {
  /**
   * True where the till is pushed on top of something (the owner's /pos),
   * false where it *is* the tab (a cashier's Sales tab, which has nothing
   * behind it to go back to).
   */
  showBack?: boolean;
}

export function PosScreen({ showBack = false }: PosScreenProps) {
  const user = useAuthStore((s: AuthState) => s.user);
  const tabBarHeight = useTabBarHeight();
  const canRecordSale = usePermission('record_sale');
  const canViewSales = usePermission('view_sales');
  const canVoidSale = usePermission('void_sale');
  // This screen only lists the viewer's own sales, so either refund grant works
  const canRefundOwn = usePermission('refund_own_sales');
  const canRefundAll = usePermission('refund_all_sales');
  const canRefundSale = canRefundOwn || canRefundAll;
  const canCreateProduct = usePermission('create_product');
  const { toast, alert } = useAlert();

  const {
    value: search,
    query: searchQuery,
    onChange: setSearchValue,
    onSubmit: onSearchSubmit,
    selectRecent: selectProductRecent,
    recentSearches: productRecentSearches,
    clearRecent: clearProductRecentSearches,
  } = useSearch('pos_products');

  const { cart, addItem, removeItem, clearCart, updateItem } = useCartStore();
  const [chosenMethod, setPaymentMethod] = useState<string>(CASH_METHOD_KEY);
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
  // Set when reopening the M-Pesa modal against a payment recovered from a
  // previous app session (see the recovery effect below) — carries its own
  // frozen phone/amount/saleItems rather than reading the live cart, since
  // the cart may have moved on by the time the cashier checks.
  const [resumePayment, setResumePayment] = useState<PendingMpesaPayment | null>(null);
  // A recovered payment still `pending` server-side (or whose outcome
  // couldn't be checked — no network on this launch). Surfaced as a banner
  // rather than an interruption, since there's nothing urgent to decide yet.
  const [pendingBanner, setPendingBanner] = useState<PendingMpesaPayment | null>(null);

  const queryClient = useQueryClient();
  const navigation = useNavigation();

  const [productsPage, setProductsPage] = useState(1);

  // Reset to page 1 alongside the keystroke rather than in an effect watching
  // the debounced query — an effect here fires a second render pass on every
  // search, and a stale page number produces an empty grid when the new query
  // has fewer pages. Only the server-search fallback paginates at all.
  const setSearch = (value: string) => {
    setSearchValue(value);
    setProductsPage(1);
  };
  const [salesPage, setSalesPage] = useState(1);

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

  // Leaving mid-sale silently loses the cart, so the hardware back gesture and
  // the header's back button both run this. Confirming now also *leaves* —
  // it used to only empty the cart, so "Discard" left the cashier standing on
  // the same screen wondering whether anything had happened.
  const confirmLeave = React.useCallback(() => {
    // Nothing to lose — leave straight away, if there is anywhere to go.
    if (cart.length === 0) {
      if (router.canGoBack()) router.back();
      return;
    }
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
            if (router.canGoBack()) router.back();
          },
        },
      ],
    });
  }, [alert, cart.length, clearCart]);

  // Intercept Android back button when mid-sale to prevent silent cart loss.
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (cart.length === 0) return false;
        confirmLeave();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [cart.length, confirmLeave])
  );

  // ── Product lookup: local first ─────────────────────────────────────────
  //
  // The catalogue is mirrored into SQLite and searched on-device. Searching
  // server-side (ten results a page) meant a network round trip per keystroke
  // burst, twenty pages to browse a 200-SKU shop, and nothing findable offline
  // unless that exact term had been searched before — the offline promise fell
  // apart at the counter, which is the one place it has to hold.
  //
  // The network is now only a background sync. If SQLite is unavailable
  // (web without COOP/COEP), we fall back to the old server search.
  const shopId = user?.shop?._id ?? '';
  const cacheEnabled = !!shopId && isOfflineDbAvailable();

  // Background refresh of the mirror. React Query owns the staleness clock and
  // the refetch, so there's no effect kicking off work and no hand-rolled
  // version counter. Never blocks the till — a failed sync just leaves the
  // previously cached catalogue in place, which is still the best source there
  // is when the shop is offline.
  const { isFetched: syncSettled, refetch: resyncCatalogue } = useQuery({
    queryKey: ['productCacheSync', shopId],
    queryFn: async () => {
      const count = await syncProductCache(shopId);
      // New rows on disk — re-run the local searches reading from them.
      await queryClient.invalidateQueries({ queryKey: ['productCache', shopId] });
      return count ?? 0;
    },
    enabled: cacheEnabled,
    staleTime: PRODUCT_CACHE_STALE_MS,
  });

  // Local search. Cheap enough to run per keystroke — it's a single indexed
  // LIKE scan against on-device SQLite, not a network round trip.
  const { data: cachedProducts } = useQuery({
    queryKey: ['productCache', shopId, searchQuery],
    queryFn: () => searchCachedProducts(shopId, searchQuery),
    enabled: cacheEnabled,
    placeholderData: keepPreviousData,
  });

  // Fall back to the server until the first sync settles, so a fresh install
  // isn't staring at an empty till while the mirror fills.
  const usingCache = cacheEnabled && syncSettled;

  const { data: productsData, refetch: refetchProducts } = useQuery({
    queryKey: ['products', searchQuery, productsPage],
    queryFn: () => getProducts({ search: searchQuery, page: productsPage, limit: 10 }),
    enabled: canRecordSale && !usingCache,
    // Stops the grid blanking on every keystroke, which it used to do (the
    // owner sales screen already got this right).
    placeholderData: keepPreviousData,
  });

  // Manual pull state (not isLoading/isRefetching) so the spinner never
  // appears for query-key changes or background invalidation refetches.
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const onPullRefresh = async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        usingCache ? resyncCatalogue() : refetchProducts(),
        refetchShopConfig(),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  };

  const { data: mySalesData } = useQuery({
    queryKey: ['mySales', salesPage],
    queryFn: () => getMySales({ page: salesPage, limit: 10 }),
    enabled: canViewSales,
  });

  const { data: shopConfigData, refetch: refetchShopConfig } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });
  const thankYouNote = shopConfigData?.data.receiptThankYouNote;
  const shopLogoUrl = shopConfigData?.data.logoUrl;
  const shopMotto = shopConfigData?.data.motto;

  // Till buttons are owner-edited from a separate screen (and often a
  // separate device — the owner's phone vs. a cashier's). The tab staying
  // mounted means React Query's own staleness clock never gets a chance to
  // fire a refetch, so a removed payment method could otherwise sit on the
  // till indefinitely. Refetch on every focus instead of trusting staleTime.
  useFocusEffect(
    React.useCallback(() => {
      refetchShopConfig();
    }, [refetchShopConfig])
  );

  const { data: paymentStatusData } = useQuery({
    queryKey: ['paymentStatus'],
    queryFn: getPaymentStatus,
    enabled: canRecordSale,
  });
  const mpesaEnabled = paymentStatusData?.data?.mpesa?.isConfigured ?? false;
  // Owner kill switch, not an opt-in — scanning has to work with zero setup,
  // so a shop synced before this field existed (or offline before its first
  // sync) still sees the button.
  const barcodeScanningEnabled = shopConfigData?.data?.barcodeScanningEnabled ?? true;

  // The shop's own till buttons. Falls back to Cash + M-PESA for shops that
  // never opened the setting, so nobody is ever left without a way to sell.
  const saleMethods = useMemo(
    () => resolveSaleMethods(shopConfigData?.data?.paymentMethods),
    [shopConfigData]
  );

  // If the selected button is removed or switched off mid-session, fall back to
  // the first one rather than posting a method the shop no longer accepts.
  // Derived, not corrected from an effect: the effect version rendered one
  // frame with the stale method still selected, and a fast till tap in that
  // frame would have posted it.
  const paymentMethod =
    saleMethods.length === 0 || saleMethods.some((m) => m.key === chosenMethod)
      ? chosenMethod
      : saleMethods[0].key;

  const createSaleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mySales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['myCommission'] });
      // Stock moved — refresh the local mirror so the till shows real levels.
      resyncCatalogue();
      clearCart();
      setManualReceiptCode('');
      setMpesaMode('stk');
      setCompletedSale(data.data);
      setReceiptVisible(true);
    },
    onError: (error: any, variables) => {
      if (isOfflineQueued(error)) {
        // Take the stock down locally too. The server hasn't seen this sale
        // yet, so without this the mirror keeps offering units that are
        // already in a customer's bag — and every oversold line comes back
        // as a permanent "Insufficient stock" rejection when the queue drains.
        // Read from the mutation's own variables rather than the cart, which
        // is cleared on the next line.
        applyOfflineStockDelta(shopId, variables.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })));
        queryClient.invalidateQueries({ queryKey: ['productCache', shopId] });

        clearCart();
        setManualReceiptCode('');
        setMpesaMode('stk');
        toast({ type: 'info', message: 'Sale saved offline — will sync when connected.' });
        return;
      }
      if (isOfflineUnavailable(error)) {
        // Nothing was saved anywhere — say so plainly instead of the
        // reassuring offline message, and keep the cart so it isn't retyped.
        toast({ type: 'error', message: error.message });
        return;
      }
      toast({ type: 'error', message: mutationErrorMessage(error, 'Sale failed') });
    },
  });

  const voidMutation = useMutation({
    mutationFn: (saleId: string) => voidSale(saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // stock restored
      queryClient.invalidateQueries({ queryKey: ['myCommission'] }); // voided sales earn no commission
      resyncCatalogue();
      setDetailsModalVisible(false);
      toast({ type: 'success', message: 'Sale voided — stock restored.' });
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        setDetailsModalVisible(false);
        toast({ type: 'info', message: 'Void saved offline — will sync when connected.' });
        return;
      }
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not void this sale.') });
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

  const refundMutation = useMutation({
    mutationFn: ({ saleId, method }: { saleId: string; method?: 'cash' }) => refundSale(saleId, { method }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['mySales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // stock restored (cash refunds)
      queryClient.invalidateQueries({ queryKey: ['myCommission'] }); // refunded sales earn no commission
      resyncCatalogue();
      setDetailsModalVisible(false);
      toast({ type: 'success', message: res.message || 'Refund processed.' });
    },
    onError: (error: any) => {
      toast({ type: 'error', message: error.response?.data?.message || 'Could not refund this sale.' });
    },
  });

  const handleRefund = (sale: Sale) => {
    // Offering "Refund via M-Pesa" without Daraja credentials only leads to a
    // rejected reversal, so an unconfigured shop is asked the simpler question.
    if (sale.paymentMethod === MPESA_METHOD_KEY && mpesaEnabled) {
      alert({
        type: 'confirm',
        title: 'Refund This Sale?',
        message: `The money for ${sale.invoiceNumber} will be returned to the customer. Send it back through M-Pesa, or hand over cash?`,
        buttons: [
          { label: 'Cancel', variant: 'ghost' },
          { label: 'Refund in Cash', onPress: () => refundMutation.mutate({ saleId: sale._id, method: 'cash' }) },
          { label: 'Refund via M-Pesa', variant: 'danger', onPress: () => refundMutation.mutate({ saleId: sale._id }) },
        ],
      });
      return;
    }
    alert({
      type: 'confirm',
      title: 'Refund This Sale?',
      message: `Hand the money for ${sale.invoiceNumber} back to the customer. The sale is removed from totals and its stock restored. This cannot be undone.`,
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Refund Sale', variant: 'danger', onPress: () => refundMutation.mutate({ saleId: sale._id, method: 'cash' }) },
      ],
    });
  };

  const products = usingCache ? cachedProducts ?? [] : productsData?.data || [];
  const mySales = mySalesData?.data || [];
  // Local search returns the whole matching set at once — there is no "next
  // page" at a counter. Pagination only exists on the fallback path.
  const productsTotalPages = usingCache ? 1 : productsData?.pagination?.pages ?? 1;
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
    if (tracksOwnStock) {
      const inCart = cart.find((i) => i._id === product._id && !i.cartVariantId)?.cartQuantity ?? 0;
      // Opening the sheet with nothing left to add would just show a disabled
      // Add button, so say why here instead.
      if (product.quantity - inCart <= 0) {
        toast({
          type: 'warning',
          message:
            inCart > 0
              ? `All ${product.quantity} of ${product.name} are already in this sale`
              : `${product.name} is out of stock`,
        });
        return;
      }
    }
    setSelectedProduct(product);
    setQuantityModalVisible(true);
  };

  const confirmAdd = (quantity: number, unitPrice?: number) => {
    if (!selectedProduct) return;
    addOrIncrementCartItem({ cart, product: selectedProduct, quantity, unitPrice, addItem, updateItem });
    setQuantityModalVisible(false);
    setSelectedProduct(null);
  };

  const confirmVariantAdd = (variant: ProductVariant, quantity: number) => {
    if (!selectedProduct) return;
    addOrIncrementCartItem({ cart, product: selectedProduct, quantity, variant, addItem, updateItem });
    setVariantModalVisible(false);
    setSelectedProduct(null);
  };

  const removeFromCart = (key: string) => {
    removeItem(key);
  };

  // What the cart already holds of the product being picked, per variant, so the
  // picker warns against the stock that's actually left rather than the shelf count.
  const variantsInCart = useMemo(
    () =>
      selectedProduct
        ? cart.reduce<Record<string, number>>((acc, item) => {
            if (item._id === selectedProduct._id && item.cartVariantId) {
              acc[item.cartVariantId] = (acc[item.cartVariantId] ?? 0) + item.cartQuantity;
            }
            return acc;
          }, {})
        : {},
    [cart, selectedProduct]
  );

  const cartPromoResults = cart.map((item) =>
    applyBestPromotion(item.promotions, item.cartQuantity, item.cartUnitPrice ?? item.sellingPrice)
  );
  const totalAmount = cartPromoResults.reduce((sum, r) => sum + r.subtotal, 0);
  const totalSavings = cartPromoResults.reduce((sum, r) => sum + r.discountAmount, 0);
  const totalCommission = cart.reduce(
    (sum, item) => sum + (item.cartVariantCommission ?? 0) * item.cartQuantity,
    0
  );

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
    // STK Push is the one flow with a precondition, and only when the shop has
    // actually connected M-Pesa Business. Everything else — cash, an
    // unconfigured M-Pesa, Airtel, a bank transfer — records and prints.
    if (paymentMethod === MPESA_METHOD_KEY && mpesaEnabled && mpesaMode === 'stk') {
      if (!isValidKenyanPhone(customerPhone)) {
        toast({ type: 'error', message: 'Enter a valid Kenyan number (e.g. +254712345678).' });
        return;
      }
      setMpesaModalVisible(true);
      return;
    }

    // A receipt code is proof of payment in the connected "Already Paid" flow,
    // so it's required there; elsewhere it's an optional reconciliation aid.
    const code = manualReceiptCode.trim();
    if (paymentMethod === MPESA_METHOD_KEY && mpesaEnabled && code.length < 6) {
      toast({ type: 'error', message: 'Enter a valid M-Pesa receipt code.' });
      return;
    }

    createSaleMutation.mutate({
      items: buildSaleItems(),
      paymentMethod,
      ...(paymentMethod === MPESA_METHOD_KEY && code.length >= 6
        ? { mpesaReceiptNumber: code }
        : {}),
    });
  };

  const handleMpesaSuccess = (transactionId: string | null, receiptNumber: string | null) => {
    setMpesaModalVisible(false);
    // A resumed modal carries its own frozen snapshot of what was being sold
    // when the STK push went out — more trustworthy than the live cart, which
    // this same transaction's recovery may be running well after the fact.
    const items = resumePayment?.saleItems ?? buildSaleItems();
    setResumePayment(null);
    usePendingMpesaStore.getState().clear();
    createSaleMutation.mutate({
      items,
      paymentMethod: 'mpesa',
      // Normal flow: link confirmed STK push transaction
      // Offline flow: no transactionId — pass receipt number for the backend to record
      ...(transactionId
        ? { mpesaTransactionId: transactionId }
        : { mpesaReceiptNumber: receiptNumber ?? undefined }),
    });
  };

  // Resolves a persisted pending payment against the server — shared by the
  // mount-time recovery effect (a previous app session ended mid-payment)
  // and the background watcher effect (the cashier cancelled the modal
  // *this* session while the payment was still genuinely open, which stops
  // the modal's own polling the instant it unmounts). Either source lands on
  // the same three outcomes, so there's one place that decides what they mean.
  const checkPendingPayment = React.useCallback((payment: PendingMpesaPayment) => {
    return getTransactionStatus(payment.transactionId)
      .then((res) => {
        const s = res.data.status;
        if (s === 'success') {
          setPendingBanner(null);
          alert({
            type: 'confirm',
            title: 'M-Pesa Payment Confirmed',
            message: `A payment of ${formatCurrency(payment.amount, user?.shop?.currency)} from ${payment.phoneNumber} has gone through. Record this sale now?`,
            buttons: [
              { label: 'Already recorded', variant: 'ghost', onPress: () => usePendingMpesaStore.getState().clear() },
              {
                label: 'Record Sale',
                onPress: () => {
                  usePendingMpesaStore.getState().clear();
                  createSaleMutation.mutate({
                    items: payment.saleItems,
                    paymentMethod: MPESA_METHOD_KEY,
                    mpesaTransactionId: payment.transactionId,
                  });
                },
              },
            ],
          });
        } else if (s === 'pending') {
          setPendingBanner(payment);
        } else {
          // failed / cancelled / timeout — nothing was charged, safe to drop.
          usePendingMpesaStore.getState().clear();
          setPendingBanner(null);
          toast({
            type: 'info',
            message: `A pending M-Pesa payment of ${formatCurrency(payment.amount, user?.shop?.currency)} to ${payment.phoneNumber} did not complete.`,
          });
        }
      })
      .catch(() => {
        // Outcome unknown (no connection right now) — keep watching/showing
        // the banner rather than guessing either way.
        setPendingBanner(payment);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.shop?.currency]);

  // Recover an M-Pesa payment left mid-flight by a previous app session (the
  // app was backgrounded and the process was later killed before the STK
  // push resolved — see MpesaPaymentModal's own AppState handling for the
  // ordinary backgrounding case, which this doesn't overlap with). Runs once
  // per shop session.
  useEffect(() => {
    if (!shopId) return;
    const payment = usePendingMpesaStore.getState().payment;
    if (!payment) return;
    if (payment.shopId !== shopId) {
      // Stale record from a different shop/login — never ask about money
      // that isn't this shop's to begin with.
      usePendingMpesaStore.getState().clear();
      return;
    }
    checkPendingPayment(payment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  // A payment the cashier cancelled out of (or that mount-time recovery
  // found) while it was still genuinely pending. Re-checks quietly in the
  // background so a payment the customer completes moments later is caught
  // without the cashier needing to notice the banner and tap it — capped so
  // an indefinitely-open till doesn't poll forever for a payment that's
  // simply never coming. Pauses while the modal itself is open (resumed via
  // the banner's "Check" button) so the two don't poll the same transaction
  // at once.
  useEffect(() => {
    if (!pendingBanner || mpesaModalVisible) return;
    const remaining = MAX_BACKGROUND_WATCH_MS - (Date.now() - new Date(pendingBanner.createdAt).getTime());
    if (remaining <= 0) return;

    const intervalId = setInterval(() => checkPendingPayment(pendingBanner), BACKGROUND_WATCH_INTERVAL_MS);
    const timeoutId = setTimeout(() => clearInterval(intervalId), remaining);
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [pendingBanner, mpesaModalVisible, checkPendingPayment]);

  if (!canRecordSale && !canViewSales) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Sales"
          showBack={showBack}
          bordered={false}
          backgroundColor={Colors.background}
        />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.restrictedText}>You do not have permission to access Sales.</Text>
        </View>
      </View>
    );
  }

  if (!canRecordSale) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="My Sales History"
          showBack={showBack}
          onBack={confirmLeave}
          bordered={false}
          backgroundColor={Colors.background}
        />
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
          shopName={user?.shop?.name || 'Dukana'}
          shopPhone={user?.shop?.phone}
          currency={user?.shop?.currency}
          thankYouNote={thankYouNote}
          logoUrl={shopLogoUrl}
          motto={shopMotto}
          canVoid={canVoidSale}
          onVoid={handleVoid}
          voiding={voidMutation.isPending}
          canRefund={canRefundSale}
          onRefund={handleRefund}
          refunding={refundMutation.isPending}
        />
      </View>
    );
  }

  return (
    <ShiftGate>
    <View style={styles.container}>
      <ScreenHeader
        title="Record Sale"
        showBack={showBack}
        onBack={confirmLeave}
        bordered={false}
        backgroundColor={Colors.background}
      />
      <ActiveShiftBar />
      {pendingBanner && (
        <View style={styles.recoveryBanner}>
          <Ionicons name="time-outline" size={16} color={Colors.warning} />
          <Text style={styles.recoveryBannerText}>
            M-Pesa payment of {formatCurrency(pendingBanner.amount, user?.shop?.currency)} to{' '}
            {pendingBanner.phoneNumber} is still awaiting confirmation.
          </Text>
          <AnimatedPressable
            onPress={() => {
              setResumePayment(pendingBanner);
              setPendingBanner(null);
              setMpesaModalVisible(true);
            }}
            style={styles.recoveryBannerBtn}
            accessibilityRole="button"
            accessibilityLabel="Check M-Pesa payment status"
          >
            <Text style={styles.recoveryBannerBtnText}>Check</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => setPendingBanner(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Ionicons name="close" size={16} color={Colors.textTertiary} />
          </AnimatedPressable>
        </View>
      )}
      <View style={styles.searchRow}>
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
        {barcodeScanningEnabled && (
          <AnimatedPressable
            onPress={() => router.push(user?.role === 'staff' ? '/(staff)/scan' : '/(owner)/scan')}
            style={styles.scanBtn}
            accessibilityRole="button"
            accessibilityLabel="Scan barcode"
          >
            <Ionicons name="barcode-outline" size={22} color={Colors.primary} />
          </AnimatedPressable>
        )}
      </View>

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
        refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={onPullRefresh} tintColor={Colors.primary} />}
        // Search used to fail silently here — zero matches rendered nothing
        // between the header and footer, indistinguishable from a stuck
        // search. This makes "no match" an explicit, distinct state from
        // "still typing" or "broken".
        ListEmptyComponent={
          <EmptyState
            title={search.trim() ? 'No matching products' : 'No products yet'}
            subtitle={
              search.trim()
                ? `Nothing matches "${search.trim()}" by name, SKU, barcode, or category.`
                : 'Add your first product to start selling.'
            }
            actionLabel={canCreateProduct ? 'Add Product' : undefined}
            onAction={
              canCreateProduct
                ? () => router.push(user?.role === 'staff' ? '/(staff)/inventory/new' : '/(owner)/inventory/new')
                : undefined
            }
          />
        }
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
                    commissionPerUnit={item.cartVariantCommission}
                    onRemove={() => removeFromCart(cartKey(item))}
                  />
                ))}
                {totalCommission > 0 && (
                  <Text style={styles.cartCommissionTotal}>
                    Your commission: {formatCurrency(totalCommission)}
                  </Text>
                )}
                <CartSummary
                  total={totalAmount}
                  totalSavings={totalSavings}
                  methods={saleMethods}
                  paymentMethod={paymentMethod}
                  onPaymentMethodChange={(m) => {
                    setPaymentMethod(m);
                    // Leaving M-Pesa drops anything only M-Pesa collects.
                    if (m !== MPESA_METHOD_KEY) {
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
        inCart={
          selectedProduct
            ? cart.find((i) => i._id === selectedProduct._id && !i.cartVariantId)?.cartQuantity ?? 0
            : 0
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
        inCartByVariant={variantsInCart}
      />

      <SaleDetailsModal
        visible={detailsModalVisible}
        onClose={() => setDetailsModalVisible(false)}
        sale={selectedSale}
        shopName={user?.shop?.name || 'Dukana'}
        shopPhone={user?.shop?.phone}
        currency={user?.shop?.currency}
        thankYouNote={thankYouNote}
        logoUrl={shopLogoUrl}
        motto={shopMotto}
        canVoid={canVoidSale}
        onVoid={handleVoid}
        voiding={voidMutation.isPending}
        canRefund={canRefundSale}
        onRefund={handleRefund}
        refunding={refundMutation.isPending}
      />

      <ReceiptModal
        visible={receiptVisible}
        onClose={() => setReceiptVisible(false)}
        sale={completedSale}
        shopName={user?.shop?.name || 'Dukana'}
        shopPhone={user?.shop?.phone}
        currency={user?.shop?.currency}
        servedByName={user?.name}
        thankYouNote={thankYouNote}
        logoUrl={shopLogoUrl}
        motto={shopMotto}
      />

      <MpesaPaymentModal
        visible={mpesaModalVisible}
        phoneNumber={resumePayment?.phoneNumber ?? customerPhone}
        amount={resumePayment?.amount ?? totalAmount}
        accountReference={undefined}
        currency={user?.shop?.currency}
        onSuccess={handleMpesaSuccess}
        onCancel={() => {
          setMpesaModalVisible(false);
          // Closing the modal stops its polling outright (it unmounts). If
          // the transaction never got a chance to resolve on its own, don't
          // just drop it — surface the banner immediately and let the
          // background watcher keep checking, instead of waiting for the
          // cashier to reopen this screen.
          const stillOpen = usePendingMpesaStore.getState().payment;
          if (stillOpen) setPendingBanner(stillOpen);
          setResumePayment(null);
        }}
        onResolved={() => {
          // Polling itself determined this is dead — nothing left to watch.
          usePendingMpesaStore.getState().clear();
          setPendingBanner(null);
        }}
        resumeTransactionId={resumePayment?.transactionId}
        onInitiated={
          resumePayment
            ? undefined
            : (transactionId) => {
                if (!shopId) return;
                usePendingMpesaStore.getState().set({
                  transactionId,
                  shopId,
                  phoneNumber: customerPhone,
                  amount: totalAmount,
                  saleItems: buildSaleItems(),
                  createdAt: new Date().toISOString(),
                });
              }
        }
      />
    </View>
    </ShiftGate>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  recoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.warningSubtle,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
  },
  recoveryBannerText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  recoveryBannerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.warning,
  },
  recoveryBannerBtnText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.white,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  searchBar: { flex: 1 },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.background },
  restrictedText: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: Typography.size.body, textAlign: 'center' },
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
  cartCommissionTotal: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.success,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  // marginBottom deliberately omitted — this is the last thing in the
  // FlatList's footer, so the space above the tab bar is already the
  // FlatList's own contentContainerStyle.paddingBottom. A marginBottom here
  // used to stack on top of that unconditionally (unlike the pagination
  // footer above, which is conditional), inflating the gap under the last
  // sale card well past what the till's list screens use everywhere else.
  historySection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
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
