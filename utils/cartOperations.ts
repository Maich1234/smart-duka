import type { Product, ProductVariant } from '@/services/products';
import { cartKey, type CartEntry } from '@/store/staffCartStore';

interface AddOrIncrementParams {
  cart: CartEntry[];
  product: Product;
  quantity: number;
  /** Present for a configurable product's specific variant. */
  variant?: ProductVariant;
  /** Manually chosen price — variable/service products only. Ignored for a variant add. */
  unitPrice?: number;
  addItem: (item: CartEntry) => void;
  updateItem: (key: string, updates: Partial<CartEntry>) => void;
}

/**
 * Adds a line to the current sale, or bumps its quantity if the same
 * product (and variant, if any) is already in the cart.
 *
 * The one cart-add implementation for both ways a cashier puts a product in
 * the sale — typing + the quantity/variant pickers, and scanning a barcode —
 * so a scanned "Milk 500ml" three times becomes one line at Qty 3, exactly
 * like tapping it three times already does.
 */
export function addOrIncrementCartItem({
  cart,
  product,
  quantity,
  variant,
  unitPrice,
  addItem,
  updateItem,
}: AddOrIncrementParams): void {
  const existing = cart.find(
    (item) => item._id === product._id && (item.cartVariantId ?? undefined) === variant?._id
  );

  if (existing) {
    updateItem(cartKey(existing), {
      cartQuantity: existing.cartQuantity + quantity,
      // A variant's price is fixed by the variant, not re-entered per scan/tap.
      ...(variant ? {} : { cartUnitPrice: unitPrice ?? existing.cartUnitPrice }),
    });
    return;
  }

  if (variant) {
    addItem({
      ...product,
      cartQuantity: quantity,
      cartUnitPrice: variant.sellingPrice,
      cartVariantId: variant._id,
      cartVariantName: variant.name,
      cartVariantCommission: variant.commissionPreview,
    });
    return;
  }

  addItem({
    ...product,
    cartQuantity: quantity,
    cartUnitPrice: unitPrice,
    // Product-level preview, for every type that isn't variant-picked.
    //
    // Withheld when the cashier set their own price: the preview is computed
    // server-side at list price, and the floor it is derived from is
    // deliberately never sent to staff, so it cannot be recomputed here. The
    // sale still pays the correct amount on the negotiated price — a quiet
    // omission beats quoting a figure that won't match the payout.
    cartVariantCommission:
      unitPrice != null && unitPrice !== product.sellingPrice ? undefined : product.commissionPreview,
  });
}
