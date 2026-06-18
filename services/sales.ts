import api from './api';

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Sale {
  _id: string;
  invoiceNumber: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: 'cash' | 'mpesa';
  staff: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateSaleData {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentMethod: 'cash' | 'mpesa';
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
  paymentMethod?: 'cash' | 'mpesa';
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
 * Get current staff member's own sales history
 */
export const getMySales = async (params?: {
  page?: number;
  limit?: number;
}): Promise<SalesResponse> => {
  const response = await api.get('/sales/me', { params });
  return response.data;
};