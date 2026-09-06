import { getDb } from '@/utils/offlineDb';
import { applyOfflineStockDelta, restoreOfflineStockDelta } from '@/utils/productCache';
import { resetOfflineDb, seedProduct, SHOP_ID } from '../testUtils';

function readProduct(id: string): any {
  const row = getDb().getFirstSync<{ payload: string }>('SELECT payload FROM product_cache WHERE id = ?', [id]);
  return row ? JSON.parse(row.payload) : null;
}

describe('productCache stock deltas', () => {
  beforeEach(() => {
    resetOfflineDb();
  });

  it('takes stock down on an offline sale and gives it back if that sale fails', () => {
    seedProduct(SHOP_ID, { _id: 'p1', name: 'Bread', quantity: 10, trackInventory: true });

    applyOfflineStockDelta(SHOP_ID, [{ productId: 'p1', quantity: 3 }]);
    expect(readProduct('p1').quantity).toBe(7);

    restoreOfflineStockDelta(SHOP_ID, [{ productId: 'p1', quantity: 3 }]);
    expect(readProduct('p1').quantity).toBe(10);
  });

  it('never takes a product below zero, even if oversold offline', () => {
    seedProduct(SHOP_ID, { _id: 'p1', name: 'Bread', quantity: 2, trackInventory: true });

    applyOfflineStockDelta(SHOP_ID, [{ productId: 'p1', quantity: 5 }]);
    expect(readProduct('p1').quantity).toBe(0);
  });

  it('moves a specific variant, not the parent product', () => {
    seedProduct(SHOP_ID, {
      _id: 'p1',
      name: 'T-Shirt',
      trackInventory: true,
      variants: [{ _id: 'v1', name: 'Small', quantity: 5 }, { _id: 'v2', name: 'Large', quantity: 5 }],
    });

    applyOfflineStockDelta(SHOP_ID, [{ productId: 'p1', variantId: 'v1', quantity: 2 }]);
    const product = readProduct('p1');
    expect(product.variants.find((v: any) => v._id === 'v1').quantity).toBe(3);
    expect(product.variants.find((v: any) => v._id === 'v2').quantity).toBe(5);
  });

  it('leaves untracked (service) products alone', () => {
    seedProduct(SHOP_ID, { _id: 'p1', name: 'Consultation', trackInventory: false, quantity: 0 });

    applyOfflineStockDelta(SHOP_ID, [{ productId: 'p1', quantity: 1 }]);
    expect(readProduct('p1').quantity).toBe(0);
  });

  it('is a no-op for a product not in the local mirror', () => {
    expect(() => applyOfflineStockDelta(SHOP_ID, [{ productId: 'missing', quantity: 1 }])).not.toThrow();
  });
});
