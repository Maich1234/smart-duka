import { create } from 'zustand';
import type { Product } from '@/services/products';

// Mirrors store/staffCartStore.ts's CartEntry/cartKey pattern — the whole
// product is embedded (not just an id) so a cart line can still be edited
// even if the product has scrolled off the current search page.
export interface PurchaseCartEntry extends Product {
  cartQuantity: number;
  cartUnitCost: number;
  cartTotalCost: number;
  cartVariantId?: string;
  cartVariantName?: string;
}

export const purchaseCartKey = (item: PurchaseCartEntry) => `${item._id}:${item.cartVariantId ?? ''}`;

export interface PurchaseCostDraft {
  /** Local-only key for list rendering/editing — never sent to the server. */
  key: string;
  category: string;
  description?: string;
  amount: number;
  notes?: string;
}

export interface SupplierSelection {
  supplierId?: string;
  supplierName: string;
}

interface PurchaseCartStore {
  supplier: SupplierSelection | null;
  items: PurchaseCartEntry[];
  additionalCosts: PurchaseCostDraft[];
  setSupplier: (s: SupplierSelection | null) => void;
  addItem: (item: PurchaseCartEntry) => void;
  updateItem: (key: string, updates: Partial<PurchaseCartEntry>) => void;
  removeItem: (key: string) => void;
  addCost: (cost: PurchaseCostDraft) => void;
  updateCost: (key: string, updates: Partial<PurchaseCostDraft>) => void;
  removeCost: (key: string) => void;
  clear: () => void;
}

export const usePurchaseCartStore = create<PurchaseCartStore>((set) => ({
  supplier: null,
  items: [],
  additionalCosts: [],
  setSupplier: (s) => set({ supplier: s }),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (key) => set((s) => ({ items: s.items.filter((i) => purchaseCartKey(i) !== key) })),
  updateItem: (key, updates) =>
    set((s) => ({
      items: s.items.map((i) => (purchaseCartKey(i) === key ? { ...i, ...updates } : i)),
    })),
  addCost: (cost) => set((s) => ({ additionalCosts: [...s.additionalCosts, cost] })),
  removeCost: (key) => set((s) => ({ additionalCosts: s.additionalCosts.filter((c) => c.key !== key) })),
  updateCost: (key, updates) =>
    set((s) => ({
      additionalCosts: s.additionalCosts.map((c) => (c.key === key ? { ...c, ...updates } : c)),
    })),
  clear: () => set({ supplier: null, items: [], additionalCosts: [] }),
}));
