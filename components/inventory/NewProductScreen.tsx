import React, { useState } from 'react';
import { useAlert } from '@/context/AlertContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { getProducts, createProduct } from '@/services/products';
import { getShopConfig } from '@/services/shop';
import { Screen } from '@/components/ui/Screen';
import { ProductForm, type ProductFormData } from '@/components/inventory/ProductForm';
import { buildProductPayload, EMPTY_PRODUCT_FORM } from './productPayload';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { isOfflineQueued, mutationErrorMessage } from '@/utils/errors';

/**
 * Create a product. Mounted under both role trees — owners always, and staff
 * holding `create_product` — so it navigates with router.back() rather than to
 * a fixed route.
 */
export function NewProductScreen() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductFormData>(EMPTY_PRODUCT_FORM);
  const { toast } = useAlert();
  const isOwner = useAuthStore((s: AuthState) => s.user?.role) === 'owner';
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

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      router.back();
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        router.back();
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
        onCancel={() => router.back()}
        isEditing={false}
        loading={createMutation.isPending}
        availableProducts={availableProducts}
        currency={currency}
        canManageMargins={marginAccess.canManageMargins}
        canSetCostPrice={marginAccess.canSetCostPrice}
      />
    </Screen>
  );
}
