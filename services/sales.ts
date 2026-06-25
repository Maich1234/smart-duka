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
}

export interface CreateSaleData {
  items: Array<{
    productId: string;
    quantity: number;
    /** Override for 'variable'/'service' (price-override-enabled) products */
    unitPrice?: number;
    /** Required for 'configurable' products */
    variantId?: string;
  }>;
  paymentMethod: 'cash' | 'mpesa' | 'card';
  /** For M-Pesa sales: links the confirmed STK Push transaction */
  mpesaTransactionId?: string;
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
  page?: number;
  limit?: number;
}): Promise<SalesResponse> => {
  const response = await api.get('/sales', { params });
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
 * Get aggregated sales stats for the current month (for the sales page hero card)
 */
export const getSalesStats = async (): Promise<SalesStatsResponse> => {
  const response = await api.get('/sales/stats');
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