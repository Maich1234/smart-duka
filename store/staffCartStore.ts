import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '@/services/products';

export interface CartEntry extends Product {
  cartQuantity: number;
  cartUnitPrice?: number;
  cartVariantId?: string;
  cartVariantName?: string;
  /** Employee's commission per unit for this variant, if the shop shows it. */
  cartVariantCommission?: number;
}

export const cartKey = (item: CartEntry) => `${item._id}:${item.cartVariantId ?? ''}`;

interface CartStore {
  cart: CartEntry[];
  addItem: (item: CartEntry) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  updateItem: (key: string, updates: Partial<CartEntry>) => void;
  // In-progress-sale UI state (till screen only). Lives here rather than as
  // local component state because it must be reachable from the tab bar,
  // which sits in a different part of the tree and can only intercept a
  // mid-sale tab switch by talking to this store, not to PosScreen directly.
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  mpesaMode: 'stk' | 'manual';
  setMpesaMode: (value: 'stk' | 'manual') => void;
  manualReceiptCode: string;
  setManualReceiptCode: (value: string) => void;
  /** Resets the three fields above. Deliberately separate from clearCart —
   *  a completed sale clears the cart but keeps customerPhone (a repeat
   *  customer's number is worth keeping prefilled); only actually *leaving*
   *  the sale (Discard, or a tab switch mid-sale) should wipe all three. */
  resetSaleFields: () => void;
}

/**
 * Persisted so a mid-sale cart survives an app kill (low-memory Android
 * reclaiming a backgrounded till, a crash, a battery pull) rather than
 * silently vanishing — the cashier would otherwise have no way to tell what
 * a customer already agreed to pay for, especially alongside a recovered
 * M-Pesa payment (see pendingMpesaStore), which is keyed to a cart snapshot
 * taken at STK-push time but re-verified against whatever's in the cart here.
 */
export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      cart: [],
      addItem: (item) => set((s) => ({ cart: [...s.cart, item] })),
      removeItem: (key) => set((s) => ({ cart: s.cart.filter((i) => cartKey(i) !== key) })),
      clearCart: () => set({ cart: [] }),
      updateItem: (key, updates) =>
        set((s) => ({
          cart: s.cart.map((i) => (cartKey(i) === key ? { ...i, ...updates } : i)),
        })),
      customerPhone: '',
      setCustomerPhone: (value) => set({ customerPhone: value }),
      mpesaMode: 'stk',
      setMpesaMode: (value) => set({ mpesaMode: value }),
      manualReceiptCode: '',
      setManualReceiptCode: (value) => set({ manualReceiptCode: value }),
      resetSaleFields: () => set({ customerPhone: '', mpesaMode: 'stk', manualReceiptCode: '' }),
    }),
    {
      name: 'staff-cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
