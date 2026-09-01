import React, { useState } from 'react';
import { useAlert } from '@/context/AlertContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { getProducts, getProductCategories, createProduct } from '@/services/products';
import { getShopConfig } from '@/services/shop';
import { Screen } from '@/components/ui/Screen';
import { ProductForm, type ProductFormData } from '@/components/inventory/ProductForm';
import { buildProductPayload, EMPTY_PRODUCT_FORM } from './productPayload';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { isOfflineQueued, mutationErrorMessage } from '@/utils/errors';

// Stable reference so ProductForm's categoryOptions memo isn't invalidated by
// a fresh `[]` on every render while the categories query is still loading.
const EMPTY_CATEGORIES: string[] = [];

/**
 * Create a product. Mounted under both role trees — owners always, and staff
 * holding `create_product`. Reached from several places (Home, the Inventory
 * tab, the scanner's unknown-barcode panel, POS's empty state); by default it
 * lands on the Inventory list afterwards regardless of origin (`router.back()`
 * alone used to return to whichever *tab* you came from, e.g. Home, rather
 * than the list holding the new product). The scanner and POS pass
 * `returnTo=back` because for those two flows returning to the mid-task
 * screen the owner was on is correct.
 */
export function NewProductScreen() {
  const queryClient = useQueryClient();
  // Set when reached from the scanner's unknown-barcode panel — prefills the
  // code so the cashier/owner never has to type what was just scanned.
  const { barcode: scannedBarcode, returnTo } = useLocalSearchParams<{ barcode?: string; returnTo?: string }>();
  const [form, setForm] = useState<ProductFormData>({ ...EMPTY_PRODUCT_FORM, barcode: scannedBarcode ?? '' });
  const { toast } = useAlert();
  const isOwner = useAuthStore((s: AuthState) => s.user?.role) === 'owner';
  // Reused on cancel and after a save so a lingering instance (this screen
  // can outlive a tab switch) never resurfaces the previous attempt's values.
  const resetForm = () => setForm({ ...EMPTY_PRODUCT_FORM, barcode: scannedBarcode ?? '' });
  const leaveAfterSave = () =>
    returnTo === 'back' ? router.back() : router.replace(isOwner ? '/(owner)/inventory' : '/(staff)/inventory');
  // Commission and variants stay owner-only. Cost price is different on a
  // create: the server requires it and there is no stored value to damage,
  // so staff enter it like anyone else.
  const marginAccess = { canManageMargins: isOwner, canSetCostPrice: true };

  const { data } = useQuery({
    queryKey: ['products', ''],
    queryFn: () => getProducts({ search: '' }),
  });
  const { data: shopData } = useQuery({ queryKey: ['shop'], queryFn: getShopConfig });
  const currency = shopData?.data?.currency ?? 'KES';
  const availableProducts = (data?.data || []).filter((p) =>
    ['standard', 'variable', 'weighted', 'refillable'].includes(p.productType)
  );
  const { data: categoriesData } = useQuery({ queryKey: ['productCategories'], queryFn: getProductCategories });
  const categories = categoriesData?.data ?? EMPTY_CATEGORIES;

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // A brand-new category typed on this product should be selectable the
      // next time someone opens this picker, not just after a manual refresh.
      queryClient.invalidateQueries({ queryKey: ['productCategories'] });
      toast({ type: 'success', message: `${data.data.name} added to your inventory` });
      resetForm();
      leaveAfterSave();
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        resetForm();
        leaveAfterSave();
        toast({ type: 'info', message: 'Product saved offline — will sync when connected.' });
        return;
      }
      toast({ type: 'error', message: mutationErrorMessage(error, 'Creation failed') });
    },
  });

  // ProductForm validates required fields itself (highlighting the specific
  // field and scrolling to it) and only calls onSave once the form is valid.
  const handleSave = () => createMutation.mutate(buildProductPayload(form, marginAccess));

  // No bottom safe-area edge: the tab bar is absolutely positioned over that
  // strip, and ProductForm pads its scroll content past it instead.
  return (
    <Screen scroll={false} padded={false} edges={['top', 'left', 'right']}>
      <ProductForm
        form={form}
        setForm={setForm}
        onSave={handleSave}
        onCancel={() => { resetForm(); router.back(); }}
        isEditing={false}
        loading={createMutation.isPending}
        availableProducts={availableProducts}
        categories={categories}
        currency={currency}
        canManageMargins={marginAccess.canManageMargins}
        canSetCostPrice={marginAccess.canSetCostPrice}
        barcodePrefilled={!!scannedBarcode}
      />
    </Screen>
  );
}
