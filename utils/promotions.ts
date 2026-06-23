import type { ProductPromotion } from '@/services/products';

export interface PromotionResult {
  payableQuantity: number;
  discountAmount: number;
  subtotal: number;
  appliedPromotionLabel: string | null;
}

/**
 * Mirrors the backend's applyPromotions in pricingEngine.js exactly (same
 * bundle-size/floor-division math) so the POS cart can preview the
 * discounted total before the checkout round-trip. The server remains the
 * source of truth for the actual charge.
 */
export function applyBestPromotion(
  promotions: ProductPromotion[] | undefined,
  quantity: number,
  unitPrice: number
): PromotionResult {
  const active = (promotions || []).filter((p) => p.isActive !== false && p.buyQty > 0 && p.freeQty > 0);
  let payableQuantity = quantity;
  let appliedPromotionLabel: string | null = null;

  for (const promo of active) {
    const bundleSize = promo.buyQty + promo.freeQty;
    const bundles = Math.floor(quantity / bundleSize);
    if (bundles < 1) continue;
    const candidate = quantity - bundles * promo.freeQty;
    if (candidate < payableQuantity) {
      payableQuantity = candidate;
      appliedPromotionLabel = promo.label || `Buy ${promo.buyQty} Get ${promo.freeQty} Free`;
    }
  }

  const subtotal = payableQuantity * unitPrice;
  return { payableQuantity, discountAmount: quantity * unitPrice - subtotal, subtotal, appliedPromotionLabel };
}
