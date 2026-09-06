import { buildOptimisticSale } from '@/utils/saleBuilder';
import type { SaleItem } from '@/services/sales';

describe('buildOptimisticSale', () => {
  const items: SaleItem[] = [
    { productId: 'p1', productName: 'Bread', quantity: 2, unitPrice: 50, subtotal: 100 },
    { productId: 'p2', productName: 'Milk', quantity: 1, unitPrice: 60, subtotal: 60 },
  ];

  it('sums line subtotals into the total — never trusts a caller-supplied total', () => {
    const sale = buildOptimisticSale({
      localId: 'abc123',
      staff: { _id: 'u1', name: 'Cashier', email: 'c@shop.test' },
      paymentMethod: 'cash',
      items,
    });

    expect(sale.totalAmount).toBe(160);
  });

  it('uses the local id as _id and marks a plainly-provisional invoice number', () => {
    const sale = buildOptimisticSale({
      localId: 'abcdef12-3456',
      staff: { _id: 'u1', name: 'Cashier', email: 'c@shop.test' },
      paymentMethod: 'cash',
      items,
    });

    expect(sale._id).toBe('abcdef12-3456');
    expect(sale.invoiceNumber).toMatch(/^PENDING-/);
    // Never a guess at the server's real (per-shop sequential) numbering.
    expect(sale.invoiceNumber).not.toMatch(/^INV-/);
  });

  it('carries through payment and M-Pesa fields untouched', () => {
    const sale = buildOptimisticSale({
      localId: 'x',
      staff: { _id: 'u1', name: 'Cashier', email: 'c@shop.test' },
      paymentMethod: 'mpesa',
      paymentMethodLabel: 'M-PESA',
      mpesaReceiptNumber: 'QGR12345XY',
      items,
    });

    expect(sale.paymentMethod).toBe('mpesa');
    expect(sale.paymentMethodLabel).toBe('M-PESA');
    expect(sale.mpesaReceiptNumber).toBe('QGR12345XY');
    expect(sale.mpesaTransactionId).toBeUndefined();
  });

  it('starts life as a completed sale, ready to print/show immediately', () => {
    const sale = buildOptimisticSale({
      localId: 'x',
      staff: { _id: 'u1', name: 'Cashier', email: 'c@shop.test' },
      paymentMethod: 'cash',
      items,
    });
    expect(sale.status).toBe('completed');
    expect(sale.items).toBe(items);
  });
});
