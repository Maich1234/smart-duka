import {
  saveLocalSale,
  getLocalSalesSnapshot,
  resolveLocalSale,
  markLocalSaleFailed,
  retryLocalSale,
  discardLocalSale,
  onLocalSalesChange,
  onLocalSaleSynced,
} from '@/utils/localSales';
import type { Sale } from '@/services/sales';
import { resetOfflineDb, signIn, SHOP_ID, USER_ID, OTHER_USER_ID } from '../testUtils';

function makeSale(id: string, overrides: Partial<Sale> = {}): Sale {
  return {
    _id: id,
    invoiceNumber: `PENDING-${id}`,
    items: [{ productId: 'p1', productName: 'Bread', quantity: 1, unitPrice: 100, subtotal: 100 }],
    totalAmount: 100,
    paymentMethod: 'cash',
    staff: { _id: USER_ID, name: 'Cashier', email: 'c@shop.test' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'completed',
    ...overrides,
  };
}

describe('localSales', () => {
  beforeEach(() => {
    resetOfflineDb();
    // getLocalSalesSnapshot now scopes to the signed-in user (see the
    // cross-staff-shared-till fix) — these tests need one signed in, same
    // as offlineQueue.test.ts's resetAllTestState.
    signIn();
  });

  it('a saved sale appears immediately, marked pending_sync', () => {
    saveLocalSale(SHOP_ID, USER_ID, makeSale('local-1'));

    const list = getLocalSalesSnapshot(SHOP_ID);
    expect(list).toHaveLength(1);
    expect(list[0]._id).toBe('local-1');
    expect(list[0].localStatus).toBe('pending_sync');
    expect(list[0].totalAmount).toBe(100);
  });

  it('scopes sales by shop', () => {
    saveLocalSale(SHOP_ID, USER_ID, makeSale('local-1'));
    saveLocalSale('shop-2', USER_ID, makeSale('local-2'));

    expect(getLocalSalesSnapshot(SHOP_ID).map((s) => s._id)).toEqual(['local-1']);
    expect(getLocalSalesSnapshot('shop-2').map((s) => s._id)).toEqual(['local-2']);
  });

  it('scopes sales by user, not just shop — a shared till never shows one cashier the other\'s pending sales', () => {
    saveLocalSale(SHOP_ID, USER_ID, makeSale('local-1'));
    signIn({ _id: OTHER_USER_ID });
    saveLocalSale(SHOP_ID, OTHER_USER_ID, makeSale('local-2'));

    expect(getLocalSalesSnapshot(SHOP_ID).map((s) => s._id)).toEqual(['local-2']);

    signIn({ _id: USER_ID });
    expect(getLocalSalesSnapshot(SHOP_ID).map((s) => s._id)).toEqual(['local-1']);
  });

  it('newest sale first', () => {
    saveLocalSale(SHOP_ID, USER_ID, makeSale('first'));
    saveLocalSale(SHOP_ID, USER_ID, makeSale('second'));

    expect(getLocalSalesSnapshot(SHOP_ID).map((s) => s._id)).toEqual(['second', 'first']);
  });

  it('resolveLocalSale removes the row — the server now owns this sale', () => {
    saveLocalSale(SHOP_ID, USER_ID, makeSale('local-1'));
    resolveLocalSale('local-1');

    expect(getLocalSalesSnapshot(SHOP_ID)).toHaveLength(0);
  });

  it('markLocalSaleFailed keeps the sale visible with the server\'s reason', () => {
    saveLocalSale(SHOP_ID, USER_ID, makeSale('local-1'));
    markLocalSaleFailed('local-1', 'That payment method was removed.');

    const [sale] = getLocalSalesSnapshot(SHOP_ID);
    expect(sale.localStatus).toBe('failed');
    expect(sale.localError).toBe('That payment method was removed.');
  });

  it('retryLocalSale clears a failed sale back to pending_sync', () => {
    saveLocalSale(SHOP_ID, USER_ID, makeSale('local-1'));
    markLocalSaleFailed('local-1', 'Rejected');
    retryLocalSale('local-1');

    const [sale] = getLocalSalesSnapshot(SHOP_ID);
    expect(sale.localStatus).toBe('pending_sync');
    expect(sale.localError).toBeNull();
  });

  it('discardLocalSale removes the sale for good', () => {
    saveLocalSale(SHOP_ID, USER_ID, makeSale('local-1'));
    markLocalSaleFailed('local-1', 'Rejected');
    discardLocalSale('local-1');

    expect(getLocalSalesSnapshot(SHOP_ID)).toHaveLength(0);
  });

  it('onLocalSalesChange fires on every write', () => {
    const listener = jest.fn();
    const unsubscribe = onLocalSalesChange(listener);

    saveLocalSale(SHOP_ID, USER_ID, makeSale('local-1'));
    markLocalSaleFailed('local-1', 'x');
    retryLocalSale('local-1');
    discardLocalSale('local-1');

    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
  });

  it('onLocalSaleSynced fires only when a sale resolves, not on save/fail', () => {
    const synced = jest.fn();
    const unsubscribe = onLocalSaleSynced(synced);

    saveLocalSale(SHOP_ID, USER_ID, makeSale('local-1'));
    markLocalSaleFailed('local-1', 'x');
    expect(synced).not.toHaveBeenCalled();

    resolveLocalSale('local-1');
    expect(synced).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('a duplicate save under the same id replaces rather than duplicates', () => {
    saveLocalSale(SHOP_ID, USER_ID, makeSale('local-1', { totalAmount: 100 }));
    saveLocalSale(SHOP_ID, USER_ID, makeSale('local-1', { totalAmount: 250 }));

    const list = getLocalSalesSnapshot(SHOP_ID);
    expect(list).toHaveLength(1);
    expect(list[0].totalAmount).toBe(250);
  });
});
