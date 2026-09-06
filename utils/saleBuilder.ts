import type { Sale, SaleItem } from '@/services/sales';

export interface OptimisticSaleInput {
  /** Client-generated id — doubles as this sale's local_sales row id. */
  localId: string;
  staff: { _id: string; name: string; email: string };
  paymentMethod: string;
  paymentMethodLabel?: string;
  mpesaTransactionId?: string;
  mpesaReceiptNumber?: string;
  items: SaleItem[];
}

/**
 * Builds the sale exactly as the till knows it, before the server has seen
 * it — everything here is data the cashier already has on-device (cart
 * lines, already-applied promotions, the shop's own payment-method label).
 *
 * The invoice number is deliberately NOT a guess at the server's own
 * numbering (which is per-shop and sequential — see the known cross-shop
 * collision bug in the invoice generator) — it is a plainly-provisional
 * reference, replaced by the real one the moment this sale syncs.
 */
export function buildOptimisticSale(input: OptimisticSaleInput): Sale {
  const totalAmount = input.items.reduce((sum, item) => sum + item.subtotal, 0);
  const now = new Date().toISOString();
  return {
    _id: input.localId,
    invoiceNumber: `PENDING-${input.localId.slice(0, 6).toUpperCase()}`,
    items: input.items,
    totalAmount,
    paymentMethod: input.paymentMethod,
    paymentMethodLabel: input.paymentMethodLabel,
    staff: input.staff,
    createdAt: now,
    updatedAt: now,
    mpesaTransactionId: input.mpesaTransactionId,
    mpesaReceiptNumber: input.mpesaReceiptNumber,
    status: 'completed',
  };
}
