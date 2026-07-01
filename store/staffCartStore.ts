import { create } from 'zustand';
import type { Product } from '@/services/products';

export interface CartEntry extends Product {
  cartQuantity: number;
  cartUnitPrice?: number;
  cartVariantId?: string;
  cartVariantName?: string;
}

export const cartKey = (item: CartEntry) => `${item._id}:${item.cartVariantId ?? ''}`;

interface CartStore {
  cart: CartEntry[];
  addItem: (item: CartEntry) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  updateItem: (key: string, updates: Partial<CartEntry>) => void;
}

export const useCartStore = create<CartStore>((set) => ({
  cart: [],
  addItem: (item) => set((s) => ({ cart: [...s.cart, item] })),
  removeItem: (key) => set((s) => ({ cart: s.cart.filter((i) => cartKey(i) !== key) })),
  clearCart: () => set({ cart: [] }),
  updateItem: (key, updates) =>
    set((s) => ({
      cart: s.cart.map((i) => (cartKey(i) === key ? { ...i, ...updates } : i)),
    })),
}));
