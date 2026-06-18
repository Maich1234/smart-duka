import api from './api';

export interface Staff {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'staff';
  isActive: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StaffResponse {
  success: boolean;
  data: Staff[];
  message?: string;
}

export interface SingleStaffResponse {
  success: boolean;
  data: Staff;
  message?: string;
}

export interface CreateStaffData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface UpdateStaffData {
  name?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  permissions?: string[];
}

export interface StaffSalesResponse {
  success: boolean;
  data: Array<{
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface Permission {
  value: string;
  label: string;
  category: string;
}

/**
 * Get all staff members for current shop (Owner only)
 */
export const getStaff = async (params?: { search?: string }): Promise<StaffResponse> => {
  const response = await api.get('/staff', { params });
  return response.data;
};

/**
 * Get single staff member by ID
 */
export const getStaffById = async (id: string): Promise<SingleStaffResponse> => {
  const response = await api.get(`/staff/${id}`);
  return response.data;
};

/**
 * Create new staff member (Owner only)
 */
export const createStaff = async (data: CreateStaffData): Promise<SingleStaffResponse> => {
  const response = await api.post('/staff', data);
  return response.data;
};

/**
 * Update staff member details (Owner only)
 */
export const updateStaff = async (id: string, data: UpdateStaffData): Promise<SingleStaffResponse> => {
  const response = await api.put(`/staff/${id}`, data);
  return response.data;
};

/**
 * Delete staff member (Owner only)
 */
export const deleteStaff = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/staff/${id}`);
  return response.data;
};

/**
 * Reset staff password (Owner only)
 */
export const resetStaffPassword = async (id: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(`/staff/${id}/reset-password`, { newPassword });
  return response.data;
};

/**
 * Get sales made by a specific staff member (Owner only)
 */
export const getStaffSales = async (id: string, params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<StaffSalesResponse> => {
  const response = await api.get(`/staff/${id}/sales`, { params });
  return response.data;
};

/**
 * Update staff permissions (Owner only)
 */
export const updateStaffPermissions = async (id: string, permissions: string[]): Promise<SingleStaffResponse> => {
  const response = await api.put(`/staff/${id}/permissions`, { permissions });
  return response.data;
};

/**
 * Get all available permissions (hardcoded on backend)
 */
export const getAllPermissions = async () => {
  const res = await api.get('/staff/permissions');
  return res.data;
};