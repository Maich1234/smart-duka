import React, { useState } from 'react';
import { useAlert } from '@/context/AlertContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { getProducts, createProduct, type CreateProductData } from '@/services/products';
import { getShopConfig } from '@/services/shop';
import { Screen } from '@/components/ui/Screen';
import { ProductForm, type ProductFormData } from '@/components/inventory/ProductForm';
import { isOfflineQueued } from '@/utils/errors';

const EMPTY_FORM: ProductFormData = {
  name: '', category: '', sellingPrice: '', costPrice: '', quantity: '', lowStockAlert: '5',
  productType: 'standard', unitOfMeasure: 'unit', trackInventory: true,
  minPrice: '', maxPrice: '', allowPriceOverride: false, bundleItems: [], variants: [],
  hasPromotions: false, promotions: [],
};

export default function NewProductScreen() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const { toast } = useAlert();

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
      toast({ type: 'error', message: error.response?.data?.message || 'Creation failed' });
    },
  });

  // ProductForm validates required fields itself (highlighting the specific
  // field and scrolling to it) and only calls onSave once the form is valid.
  const handleSave = () => {

    // Bundle/configurable products carry no meaningful stock of their own —
    // real availability lives on bundle components / variants instead.
    const isCompositeType = form.productType === 'bundle' || form.productType === 'configurable';

    const payload: CreateProductData = {
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

    createMutation.mutate(payload);
  };

  return (
    <Screen scroll={false} padded={false}>
      <ProductForm
        form={form}
        setForm={setForm}
        onSave={handleSave}
        onCancel={() => router.back()}
        isEditing={false}
        loading={createMutation.isPending}
        availableProducts={availableProducts}
        currency={currency}
      />
    </Screen>
  );
}
