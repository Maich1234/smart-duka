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
    }),
    {
      name: 'staff-cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
