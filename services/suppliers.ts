import api from './api';

export interface Supplier {
  _id: string;
  shop: string;
  name: string;
  phone?: string;
  email?: string;
  location?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierStats {
  purchaseCount: number;
  totalSpend: number;
  averagePurchaseCost: number;
  lastPurchaseDate: string | null;
}

export interface SupplierDetail extends Supplier {
  stats: SupplierStats;
  recentPurchases: Array<{ _id: string; grandTotal: number; createdAt: string; status: string }>;
}

export interface SuppliersResponse {
  success: boolean;
  data: Supplier[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface SupplierResponse {
  success: boolean;
  data: Supplier;
  message?: string;
}

export interface SupplierDetailResponse {
  success: boolean;
  data: SupplierDetail;
}

export interface CreateSupplierData {
  name: string;
  phone?: string;
  email?: string;
  location?: string;
  notes?: string;
}

export type UpdateSupplierData = Partial<CreateSupplierData> & { isActive?: boolean };

/** Owner, or staff with 'view_purchases' */
export const getSuppliers = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<SuppliersResponse> => {
  const response = await api.get('/suppliers', { params });
  return response.data;
};

/** Includes recent-purchases/spend/average-cost stats computed on demand. */
export const getSupplierById = async (id: string): Promise<SupplierDetailResponse> => {
  const response = await api.get(`/suppliers/${id}`);
  return response.data;
};

/** Owner, or staff with 'create_purchases' */
export const createSupplier = async (data: CreateSupplierData): Promise<SupplierResponse> => {
  const response = await api.post('/suppliers', data);
  return response.data;
};

/** Owner, or staff with 'edit_purchases' */
export const updateSupplier = async (id: string, data: UpdateSupplierData): Promise<SupplierResponse> => {
  const response = await api.put(`/suppliers/${id}`, data);
  return response.data;
};

/** Soft-delete (owner, or staff with 'delete_purchases') — kept for historical purchase records, just hidden from the picker. */
export const deleteSupplier = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/suppliers/${id}`);
  return response.data;
};
