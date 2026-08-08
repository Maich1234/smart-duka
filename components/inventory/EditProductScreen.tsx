import React, { useState } from 'react';
import { useAlert } from '@/context/AlertContext';
import { LoadingState } from '@/components/ui/LoadingState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { getProductById, getProducts, getProductCategories, updateProduct, type Product, type UpdateProductData } from '@/services/products';
import { getShopConfig } from '@/services/shop';
import { Screen } from '@/components/ui/Screen';
import { ProductForm, type ProductFormData } from '@/components/inventory/ProductForm';
import { buildProductPayload } from './productPayload';
import { useAuthStore, type AuthState } from '@/store/authStore';

// Stable reference so ProductForm's categoryOptions memo isn't invalidated by
// a fresh `[]` on every render while the categories query is still loading.
const EMPTY_CATEGORIES: string[] = [];

/** The saved product rendered into the shape ProductForm edits. */
const toFormData = (product: Product): ProductFormData => ({
  name: product.name,
  category: product.category,
  sku: product.sku ?? '',
  barcode: product.barcode ?? '',
  sellingPrice: String(product.sellingPrice),
  costPrice: String(product.costPrice ?? ''),
  quantity: String(product.quantity),
  lowStockAlert: String(product.lowStockAlert),
  productType: product.productType || 'standard',
  unitOfMeasure: product.unitOfMeasure || 'unit',
  trackInventory: product.trackInventory ?? true,
  minPrice: product.minPrice != null ? String(product.minPrice) : '',
  maxPrice: product.maxPrice != null ? String(product.maxPrice) : '',
  allowPriceOverride: product.allowPriceOverride ?? false,
  bundleItems: (product.bundleItems || []).map((b) => ({ product: b.product, quantity: String(b.quantity) })),
  commissionEnabled: product.commission?.enabled ?? false,
  commissionBasePrice: product.commission?.basePrice != null ? String(product.commission.basePrice) : '',
  commissionEmployeeSharePercent: String(product.commission?.employeeSharePercent ?? 100),
  variants: (product.variants || []).map((v) => ({
    id: v._id,
    name: v.name,
    sellingPrice: String(v.sellingPrice),
    costPrice: String(v.costPrice ?? ''),
    quantity: String(v.quantity),
    lowStockAlert: String(v.lowStockAlert),
    commissionEnabled: v.commission?.enabled ?? false,
    commissionBasePrice: v.commission?.basePrice != null ? String(v.commission.basePrice) : '',
    commissionEmployeeSharePercent: String(v.commission?.employeeSharePercent ?? 100),
  })),
  hasPromotions: (product.promotions?.length || 0) > 0,
  promotions: (product.promotions || []).map((p) => ({
    label: p.label || '',
    buyQty: String(p.buyQty),
    freeQty: String(p.freeQty),
    isActive: p.isActive ?? true,
  })),
});

/**
 * Waits for the product, then hands it to the editor below.
 *
 * The split is what removes the old seed-from-an-effect step: the form is
 * initialised from real data on its very first render instead of mounting
 * blank and being filled in afterwards, and `key` guarantees a different
 * product gets a fresh form rather than the previous one's edits.
 *
 * Mounted under both role trees — owners always, and staff holding
 * `edit_product` — so it navigates with router.back().
 */
export function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: productData, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProductById(id),
  });
  const product = productData?.data;

  if (isLoading || !product) {
    return <LoadingState />;
  }

  return <EditProductForm key={product._id} id={id} product={product} />;
}

function EditProductForm({ id, product }: { id: string; product: Product }) {
  const queryClient = useQueryClient();
  const { toast } = useAlert();
  // Lazy initialiser: computed once on mount, never re-derived from props.
  const [form, setForm] = useState<ProductFormData>(() => toFormData(product));
  const isOwner = useAuthStore((s: AuthState) => s.user?.role) === 'owner';
  // Everything margin-bearing is owner-only here: this form is seeded from a
  // response that had cost price and commission stripped for staff, so posting
  // those fields back would overwrite real values with blanks.
  const marginAccess = { canManageMargins: isOwner, canSetCostPrice: isOwner };

  const { data: productsData } = useQuery({
    queryKey: ['products', ''],
    queryFn: () => getProducts({ search: '' }),
  });
  const { data: shopData } = useQuery({ queryKey: ['shop'], queryFn: getShopConfig });
  const currency = shopData?.data?.currency ?? 'KES';
  const availableProducts = (productsData?.data || []).filter(
    (p) => p._id !== id && ['standard', 'variable', 'weighted', 'refillable'].includes(p.productType)
  );
  const { data: categoriesData } = useQuery({ queryKey: ['productCategories'], queryFn: getProductCategories });
  const categories = categoriesData?.data ?? EMPTY_CATEGORIES;

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProductData) => updateProduct(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      // A category renamed to something new here should show up next time
      // this picker opens, not just after a manual refresh.
      queryClient.invalidateQueries({ queryKey: ['productCategories'] });
      toast({ type: 'success', message: `${data.data.name} updated` });
      router.back();
    },
    onError: (error: any) =>
      toast({ type: 'error', message: error.response?.data?.message || 'Update failed' }),
  });

  // ProductForm validates required fields itself (highlighting the specific
  // field and scrolling to it) and only calls onSave once the form is valid.
  const handleSave = () => updateMutation.mutate(buildProductPayload(form, marginAccess));

  // Bottom edge omitted — see the note in NewProductScreen.
  return (
    <Screen scroll={false} padded={false} edges={['top', 'left', 'right']}>
      <ProductForm
        form={form}
        setForm={setForm}
        onSave={handleSave}
        onCancel={() => router.back()}
        isEditing
        loading={updateMutation.isPending}
        availableProducts={availableProducts}
        categories={categories}
        currency={currency}
        canManageMargins={marginAccess.canManageMargins}
        canSetCostPrice={marginAccess.canSetCostPrice}
      />
    </Screen>
  );
}
