import api from './api';

export type PurchaseCostCategory =
  | 'transport' | 'delivery' | 'fuel' | 'loading' | 'offloading'
  | 'packaging' | 'market_fee' | 'brokerage' | 'insurance' | 'other';

export type PurchaseAllocationMethod = 'quantity' | 'value' | 'none';

export type PurchaseStatus = 'completed' | 'pending_approval' | 'cancelled';

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  /** Omitted from the response when the requester lacks 'view_purchase_prices'. */
  unitCost?: number;
  totalCost?: number;
  variantId?: string;
  variantName?: string;
  unitOfMeasure?: string;
}

export interface PurchaseCost {
  _id: string;
  category: PurchaseCostCategory;
  description?: string;
  /** Omitted from the response when the requester lacks 'view_purchase_prices'. */
  amount?: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  _id: string;
  shop: string;
  supplier?: { _id: string; name: string; phone?: string; email?: string; location?: string } | string;
  supplierName: string;
  items: PurchaseItem[];
  additionalCosts: PurchaseCost[];
  /** Omitted from the response when the requester lacks 'view_purchase_prices'. */
  productsTotal?: number;
  additionalCostsTotal?: number;
  grandTotal?: number;
  allocationMethod: PurchaseAllocationMethod;
  status: PurchaseStatus;
  inventoryUpdated: boolean;
  staff: { _id: string; name: string };
  purchaseDate: string;
  cancelledAt?: string;
  cancelledBy?: { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseItemData {
  productId: string;
  quantity: number;
  unitCost: number;
  /** Required for 'configurable' products */
  variantId?: string;
}

export interface CreatePurchaseCostData {
  category: PurchaseCostCategory;
  description?: string;
  amount: number;
  notes?: string;
}

export interface CreatePurchaseData {
  /** Omitted for walk-in / no-supplier purchases */
  supplierId?: string;
  /** Manual walk-in label, shown when no supplierId is given */
  supplierName?: string;
  items: CreatePurchaseItemData[];
  additionalCosts?: CreatePurchaseCostData[];
  purchaseDate?: string;
}

export interface UpdatePurchaseData {
  supplierId?: string | null;
  supplierName?: string;
  items?: CreatePurchaseItemData[];
  additionalCosts?: CreatePurchaseCostData[];
  purchaseDate?: string;
}

export interface PurchaseStats {
  purchaseCount: number;
  totalSpend: number;
  productsPurchased: number;
  suppliersUsed: number;
  recentPurchases: Purchase[];
}

export interface PurchaseTrendPoint {
  label: string;
  date: string;
  productsTotal: number;
  additionalCostsTotal: number;
  grandTotal: number;
  purchaseCount: number;
}

export interface PurchaseAnalytics {
  period: 'daily' | 'weekly' | 'monthly';
  rangeStart: string;
  series: PurchaseTrendPoint[];
  summary: {
    totalInventoryPurchased: number;
    totalAdditionalCosts: number;
    totalProcurementCost: number;
    averageProcurementCost: number;
  };
  costBreakdown: { category: PurchaseCostCategory; amount: number }[];
  topProducts: { _id: string; productName: string; quantity: number; totalCost: number }[];
  supplierSpend: { _id: string; supplierName?: string; purchaseCount: number; totalSpend: number }[];
}

export interface PurchasesResponse {
  success: boolean;
  data: Purchase[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface PurchaseResponse {
  success: boolean;
  data: Purchase;
  message?: string;
}

export interface PurchaseStatsResponse {
  success: boolean;
  data: PurchaseStats;
}

export interface PurchaseAnalyticsResponse {
  success: boolean;
  data: PurchaseAnalytics;
}

/** Owner, or staff with 'create_purchases' */
export const createPurchase = async (data: CreatePurchaseData): Promise<PurchaseResponse> => {
  const response = await api.post('/purchases', data);
  return response.data;
};

/** Owner, or staff with 'view_purchases' (sees every shop purchase, not just their own) */
export const getPurchases = async (params?: {
  startDate?: string;
  endDate?: string;
  staffId?: string;
  supplierId?: string;
  productId?: string;
  status?: PurchaseStatus;
  minCost?: number;
  maxCost?: number;
  /** Server-side search across supplier name and product names */
  search?: string;
  sort?: 'newest' | 'oldest' | 'highest_cost' | 'lowest_cost';
  page?: number;
  limit?: number;
}): Promise<PurchasesResponse> => {
  const response = await api.get('/purchases', { params });
  return response.data;
};

export const getPurchaseById = async (id: string): Promise<PurchaseResponse> => {
  const response = await api.get(`/purchases/${id}`);
  return response.data;
};

/**
 * Edits an existing purchase. Stock is corrected by delta (undo the old
 * quantities, apply the new ones) rather than a full retroactive recost —
 * see backend purchaseController.js for the rationale.
 * Owner, or staff with 'edit_purchases'.
 */
export const updatePurchase = async (id: string, data: UpdatePurchaseData): Promise<PurchaseResponse> => {
  const response = await api.put(`/purchases/${id}`, data);
  return response.data;
};

/**
 * Soft-cancels a purchase: stock it added is best-effort reversed, the
 * record itself is kept (status → 'cancelled') for history.
 * Owner, or staff with 'delete_purchases'.
 */
export const deletePurchase = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/purchases/${id}`);
  return response.data;
};

/** Owner-only: releases a pending-approval purchase's stock/cost impact. */
export const approvePurchase = async (id: string): Promise<PurchaseResponse> => {
  const response = await api.post(`/purchases/${id}/approve`, {});
  return response.data;
};

/** Today's numbers for the Purchasing home dashboard. */
export const getPurchaseStats = async (): Promise<PurchaseStatsResponse> => {
  const response = await api.get('/purchases/stats');
  return response.data;
};

/** Procurement Analytics screen data — cost breakdown, top products, supplier spend. */
export const getPurchaseAnalytics = async (params?: {
  period?: 'daily' | 'weekly' | 'monthly';
}): Promise<PurchaseAnalyticsResponse> => {
  const response = await api.get('/purchases/analytics', { params });
  return response.data;
};
