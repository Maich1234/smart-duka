import type { CreateProductData } from '@/services/products';
import type { ProductFormData } from './ProductForm';

/**
 * What the viewer may set on the shop's margin-bearing fields.
 *
 * `canSetCostPrice` is separate from `canManageMargins` because overwriting
 * and entering are different acts: staff are never sent `costPrice`, so on an
 * edit their form holds a blank that would destroy the stored value, but on a
 * create there is nothing to destroy and the server requires the field.
 */
export interface MarginAccess {
  /** Commission, and the cost of a *saved* variant — owner-only throughout. */
  canManageMargins: boolean;
  /** Cost price — everyone on create, owner-only on edit. */
  canSetCostPrice: boolean;
}

const FULL_MARGIN_ACCESS: MarginAccess = { canManageMargins: true, canSetCostPrice: true };

/**
 * Turns the form's strings into the API payload.
 *
 * Shared by the create and edit screens, which built this independently and
 * had already drifted once — every field added to one had to be remembered in
 * the other. `CreateProductData` is assignable to `UpdateProductData`, so one
 * builder serves both.
 */
export const buildProductPayload = (
  form: ProductFormData,
  { canManageMargins, canSetCostPrice }: MarginAccess = FULL_MARGIN_ACCESS
): CreateProductData => {
  // Bundle/configurable products carry no meaningful stock of their own —
  // real availability lives on bundle components / variants instead.
  const isCompositeType = form.productType === 'bundle' || form.productType === 'configurable';

  const payload: CreateProductData = {
    name: form.name,
    category: form.category.toLowerCase(),
    // Sent even when blank, like promotions below, so clearing the field
    // actually clears a previously saved SKU instead of leaving it stuck.
    sku: form.sku?.trim() ?? '',
    barcode: form.barcode?.trim() ?? '',
    productType: form.productType,
    sellingPrice: parseFloat(form.sellingPrice),
    quantity: parseInt(form.quantity) || 0,
    lowStockAlert: parseInt(form.lowStockAlert) || 5,
    trackInventory: isCompositeType ? false : form.trackInventory,
  };

  // Omitted rather than sent when the viewer can't see it: updates are
  // partial server-side, so an absent key preserves the stored value while a
  // blank one (NaN → null) would destroy it. The server drops it from a staff
  // update too — this half is so the form isn't lying about what it saves.
  if (canSetCostPrice) {
    payload.costPrice = parseFloat(form.costPrice);
  }

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
  // Product-level commission travels for every product type. Sent even when
  // disabled so turning it off actually clears the stored config.
  if (canManageMargins) {
    // A Variable Price product's Min Price doubles as its commission floor
    // (see ProductForm's effectiveCommissionBasePrice) — mirrored here so
    // what's saved can't drift from what the form displayed, even if
    // commissionBasePrice itself is stale.
    const effectiveBasePrice =
      form.productType === 'variable' && form.minPrice.trim() ? form.minPrice : form.commissionBasePrice;
    payload.commission = form.commissionEnabled
      ? {
          enabled: true,
          basePrice: parseFloat(effectiveBasePrice) || 0,
          employeeSharePercent: parseFloat(form.commissionEmployeeSharePercent) || 100,
        }
      : { enabled: false };
  }
  if (form.productType === 'bundle') {
    payload.bundleItems = form.bundleItems.map((b) => ({
      product: b.product,
      quantity: parseFloat(b.quantity) || 1,
    }));
  }
  if (form.productType === 'configurable') {
    payload.variants = form.variants.map((v) => ({
      // Echoed so the server keeps this variant's identity (and can match it
      // to the stored row when the editor is staff).
      ...(v.id ? { _id: v.id } : {}),
      name: v.name,
      sellingPrice: parseFloat(v.sellingPrice) || 0,
      // A saved variant's cost was never shown to staff, so it is left out and
      // the server carries the stored value over. A variant added here has no
      // stored value to protect, so its cost travels.
      ...(canManageMargins || !v.id ? { costPrice: parseFloat(v.costPrice) || 0 } : {}),
      quantity: parseInt(v.quantity) || 0,
      lowStockAlert: parseInt(v.lowStockAlert) || 5,
      // Commission is the owner's call; the server ignores it from staff.
      ...(canManageMargins
        ? {
            commission: v.commissionEnabled
              ? {
                  enabled: true,
                  basePrice: parseFloat(v.commissionBasePrice) || 0,
                  employeeSharePercent: parseFloat(v.commissionEmployeeSharePercent) || 100,
                }
              : { enabled: false },
          }
        : {}),
    }));
  }
  // Sent even when empty, so clearing every promotion actually removes them.
  if (!isCompositeType) {
    payload.promotions = form.hasPromotions
      ? form.promotions
          .filter((p) => p.buyQty && p.freeQty)
          .map((p) => ({
            label: p.label,
            buyQty: parseInt(p.buyQty) || 1,
            freeQty: parseInt(p.freeQty) || 1,
            isActive: p.isActive,
          }))
      : [];
  }

  return payload;
};

export const EMPTY_PRODUCT_FORM: ProductFormData = {
  name: '', category: '', barcode: '', sellingPrice: '', costPrice: '', quantity: '', lowStockAlert: '5',
  productType: 'standard', unitOfMeasure: 'unit', trackInventory: true,
  minPrice: '', maxPrice: '', allowPriceOverride: false, bundleItems: [], variants: [],
  commissionEnabled: false, commissionBasePrice: '', commissionEmployeeSharePercent: '100',
  hasPromotions: false, promotions: [],
};
