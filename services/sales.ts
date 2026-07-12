import api from './api';

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount?: number;
  appliedPromotionLabel?: string;
  variantId?: string;
  variantName?: string;
  unitOfMeasure?: string;
  productType?: string;
}

export interface Sale {
  _id: string;
  invoiceNumber: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: 'cash' | 'mpesa' | 'card';
  staff: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  /** Only present on createSale/getSaleById responses — used to build the receipt QR code */
  receiptToken?: string;
  // M-Pesa fields (populated for mpesa payment method)
  mpesaTransactionId?: string;
  mpesaReceiptNumber?: string;
  /** 'voided'/'refunded' sales stay in history but are excluded from all revenue stats */
  status?: 'completed' | 'voided' | 'refund_pending' | 'refunded';
  voidedAt?: string;
  voidReason?: string;
  /** Refund lifecycle — set once a refund has been requested for this sale */
  refund?: {
    amount?: number;
    method?: 'cash' | 'mpesa';
    reason?: string;
    requestedAt?: string;
    completedAt?: string;
    /** Why the last M-Pesa reversal attempt failed (sale returns to 'completed') */
    failureReason?: string;
  };
}

export interface CreateSaleData {
  items: {
    productId: string;
    quantity: number;
    /** Override for 'variable'/'service' (price-override-enabled) products */
    unitPrice?: number;
    /** Required for 'configurable' products */
    variantId?: string;
  }[];
  paymentMethod: 'cash' | 'mpesa' | 'card';
  /** Normal M-Pesa flow: links the confirmed STK Push transaction */
  mpesaTransactionId?: string;
  /** Offline fallback: M-Pesa receipt code entered manually from customer's SMS */
  mpesaReceiptNumber?: string;
}

export interface SalesStats {
  totalSales: number;
  cashTotal: number;
  mpesaTotal: number;
  cardTotal: number;
  cashCount: number;
  mpesaCount: number;
  cardCount: number;
  transactionCount: number;
  avgSale: number;
  percentageChange: number;
}

export interface SalesStatsResponse {
  success: boolean;
  data: SalesStats;
}

export interface SalesResponse {
  success: boolean;
  data: Sale[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface SaleResponse {
  success: boolean;
  data: Sale;
  message?: string;
}

/**
 * Create a new sale (record customer purchase)
 * Staff requires 'record_sale' permission
 */
export const createSale = async (data: CreateSaleData): Promise<SaleResponse> => {
  const response = await api.post('/sales', data);
  return response.data;
};

/**
 * Get all sales with filters
 * Owner sees all; staff sees only their own unless granted 'view_all_sales' permission
 * @param params - startDate, endDate, staffId, paymentMethod, page, limit
 */
export const getSales = async (params?: {
  startDate?: string;
  endDate?: string;
  staffId?: string;
  paymentMethod?: 'cash' | 'mpesa' | 'card';
  /** Server-side search across invoice number and cashier name */
  search?: string;
  page?: number;
  limit?: number;
}): Promise<SalesResponse> => {
  const response = await api.get('/sales', { params });
  return response.data;
};

/**
 * Void a mis-recorded sale: restores the stock it deducted and removes it
 * from all revenue stats (it stays in history with a voided badge).
 * Owner, or staff with the 'void_sale' permission.
 */
export const voidSale = async (id: string, reason?: string): Promise<SaleResponse> => {
  const response = await api.post(`/sales/${id}/void`, reason ? { reason } : {});
  return response.data;
};

/**
 * Refund a sale: returns the customer's money and restores stock.
 * M-Pesa sales are reversed through Safaricom (async — the sale sits in
 * 'refund_pending' until the reversal completes); pass method 'cash' to hand
 * the money back over the counter instead. Owner, or staff with
 * 'refund_own_sales' (own sales) / 'refund_all_sales' (any sale).
 */
export const refundSale = async (
  id: string,
  opts?: { reason?: string; method?: 'cash' }
): Promise<SaleResponse> => {
  const response = await api.post(`/sales/${id}/refund`, {
    ...(opts?.reason ? { reason: opts.reason } : {}),
    ...(opts?.method ? { method: opts.method } : {}),
  });
  return response.data;
};

/**
 * Get sale by ID
 */
export const getSaleById = async (id: string): Promise<SaleResponse> => {
  const response = await api.get(`/sales/${id}`);
  return response.data;
};

/**
 * Get aggregated sales stats, optionally scoped to a date range.
 * When no dates are passed the backend returns the current-month totals.
 */
export const getSalesStats = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<SalesStatsResponse> => {
  const response = await api.get('/sales/stats', { params });
  return response.data;
};

/**
 * Get current staff member's own sales history
 */
export const getMySales = async (params?: {
  page?: number;
  limit?: number;
}): Promise<SalesResponse> => {
  const response = await api.get('/sales/me', { params });
  return response.data;
};