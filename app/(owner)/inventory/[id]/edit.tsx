import React, { useState, useEffect } from 'react';
import { useAlert } from '@/context/AlertContext';
import { LoadingState } from '@/components/ui/LoadingState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { getProductById, getProducts, updateProduct, type UpdateProductData } from '@/services/products';
import { getShopConfig } from '@/services/shop';
import { Screen } from '@/components/ui/Screen';
import { ProductForm, type ProductFormData } from '@/components/inventory/ProductForm';

const EMPTY_FORM: ProductFormData = {
  name: '', category: '', sellingPrice: '', costPrice: '', quantity: '', lowStockAlert: '5',
  productType: 'standard', unitOfMeasure: 'unit', trackInventory: true,
  minPrice: '', maxPrice: '', allowPriceOverride: false, bundleItems: [], variants: [],
  hasPromotions: false, promotions: [],
};

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [seeded, setSeeded] = useState(false);
  const { toast } = useAlert();

  const { data: productData, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProductById(id),
  });
  const product = productData?.data;

  useEffect(() => {
    if (product && !seeded) {
      setForm({
        name: product.name,
        category: product.category,
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
        variants: (product.variants || []).map((v) => ({
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
      setSeeded(true);
    }
  }, [product, seeded]);

  const { data: productsData } = useQuery({
    queryKey: ['products', ''],
    queryFn: () => getProducts({ search: '' }),
  });
  const { data: shopData } = useQuery({ queryKey: ['shop'], queryFn: getShopConfig });
  const currency = shopData?.data?.currency ?? 'KES';
  const availableProducts = (productsData?.data || []).filter(
    (p) => p._id !== id && ['standard', 'variable', 'weighted', 'refillable'].includes(p.productType)
  );

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProductData) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      router.back();
    },
    onError: (error: any) =>
      toast({ type: 'error', message: error.response?.data?.message || 'Update failed' }),
  });

  // ProductForm validates required fields itself (highlighting the specific
  // field and scrolling to it) and only calls onSave once the form is valid.
  const handleSave = () => {

    // Bundle/configurable products carry no meaningful stock of their own —
    // real availability lives on bundle components / variants instead.
    const isCompositeType = form.productType === 'bundle' || form.productType === 'configurable';

    const payload: UpdateProductData = {
      name: form.name,
      category: form.category.toLowerCase(),
      productType: form.productType,
      sellingPrice: parseFloat(form.sellingPrice),
      costPrice: parseFloat(form.costPrice),
      quantity: parseInt(form.quantity) || 0,
      lowStockAlert: parseInt(form.lowStockAlert) || 5,
      trackInventory: isCompositeType ? false : form.trackInventory,
    };

    if (form.unitOfMeasure && form.unitOfMeasure !== 'unit') {
      payload.unitOfMeasure = form.unitOfMeasure;
    }
    if (form.productType === 'variable') {
      if (form.minPrice) payload.minPrice = parseFloat(form.minPrice);
      if (form.maxPrice) payload.maxPrice = parseFloat(form.maxPrice);
    }
    if (form.productType === 'service') {
      payload.allowPriceOverride = form.allowPriceOverride;
    }
    if (form.productType === 'bundle') {
      payload.bundleItems = form.bundleItems.map((b) => ({ product: b.product, quantity: parseFloat(b.quantity) || 1 }));
    }
    if (form.productType === 'configurable') {
      payload.variants = form.variants.map((v) => ({
        name: v.name,
        sellingPrice: parseFloat(v.sellingPrice) || 0,
        costPrice: parseFloat(v.costPrice) || 0,
        quantity: parseInt(v.quantity) || 0,
        lowStockAlert: parseInt(v.lowStockAlert) || 5,
        commission: v.commissionEnabled
          ? {
              enabled: true,
              basePrice: parseFloat(v.commissionBasePrice) || 0,
              employeeSharePercent: parseFloat(v.commissionEmployeeSharePercent) || 100,
            }
          : { enabled: false },
      }));
    }
    if (!isCompositeType) {
      payload.promotions = form.hasPromotions
        ? form.promotions
            .filter((p) => p.buyQty && p.freeQty)
            .map((p) => ({ label: p.label, buyQty: parseInt(p.buyQty) || 1, freeQty: parseInt(p.freeQty) || 1, isActive: p.isActive }))
        : [];
    }

    updateMutation.mutate(payload);
  };

  if (isLoading || !seeded) {
    return <LoadingState />;
  }

  return (
    <Screen scroll={false} padded={false}>
      <ProductForm
        form={form}
        setForm={setForm}
        onSave={handleSave}
        onCancel={() => router.back()}
        isEditing
        loading={updateMutation.isPending}
        availableProducts={availableProducts}
        currency={currency}
      />
    </Screen>
  );
}
