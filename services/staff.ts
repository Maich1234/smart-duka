import api from './api';
import type { CommissionSummaryResponse } from './sales';

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
  pagination: { page: number; limit: number; total: number; pages: number };
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
  permissions?: string[];
}

/** Shape of the 409 the backend returns when adding a seat would raise the bill — payment is required. */
export interface SeatPriceConfirmation {
  currentAmount: number;
  projectedAmount: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
}

export type SeatPaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout';

export interface SeatPaymentState {
  paymentId: string;
  status: SeatPaymentStatus;
  amount: number;
  currency: string;
  receipt: string | null;
  errorMessage: string | null;
  staff: Staff | null;
}

export type InitiateSeatPaymentResult =
  | { mode: 'created'; staff: Staff }
  | { mode: 'payment_pending'; paymentId: string; amount: number; currency: string };

export interface UpdateStaffData {
  name?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  permissions?: string[];
}

export interface StaffSalesResponse {
  success: boolean;
  data: {
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
  }[];
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
export const getStaff = async (params?: { search?: string; page?: number; limit?: number }): Promise<StaffResponse> => {
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

/** Checks whether an email is already taken — used for the system-generated email field's onBlur check. */
export const checkStaffEmailAvailability = async (email: string): Promise<{ available: boolean }> => {
  const response = await api.get('/staff/check-email', { params: { email } });
  return response.data.data;
};

/**
 * Starts an M-PESA STK Push for the seat this staff member would occupy.
 * If the seat turns out to be free by the time this runs (e.g. someone else
 * was just removed), the backend creates the staff directly instead —
 * check `mode` on the response.
 */
export const initiateSeatPayment = async (
  data: CreateStaffData & { phoneNumber: string },
  idempotencyKey?: string
): Promise<{ success: boolean; data: InitiateSeatPaymentResult; message?: string }> => {
  const response = await api.post(
    '/staff/seat-payment',
    data,
    idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined
  );
  return response.data;
};

export const getSeatPaymentStatus = async (paymentId: string): Promise<{ success: boolean; data: SeatPaymentState }> => {
  const response = await api.get(`/staff/seat-payment/${paymentId}`);
  return response.data;
};

/** Re-verifies a specific seat payment directly against M-PESA — "I definitely paid, check again." */
export const recheckSeatPayment = async (paymentId: string): Promise<{ success: boolean; data: SeatPaymentState }> => {
  const response = await api.post(`/staff/seat-payment/${paymentId}/recheck`);
  return response.data;
};

/** Recovery path: the owner pastes their M-PESA confirmation SMS to unblock a seat payment that never activated. */
export const reconcileSeatPaymentByMessage = async (message: string): Promise<{ success: boolean; data: SeatPaymentState; message: string }> => {
  const response = await api.post('/staff/seat-payment/reconcile', { message });
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
 * Get a staff member's commission summary (Owner only) — always visible to
 * the owner regardless of the `showStaffCommission` toggle, which only
 * gates the staff member's own view of the same data.
 */
export const getStaffCommission = async (id: string, params?: {
  startDate?: string;
  endDate?: string;
}): Promise<CommissionSummaryResponse> => {
  const response = await api.get(`/staff/${id}/commission`, { params });
  return response.data;
};

/**
 * Update staff permissions (Owner only)
 */
export const updateStaffPermissions = async (id: string, permissions: string[]): Promise<SingleStaffResponse> => {
  const response = await api.put(`/staff/${id}/permissions`, { permissions });
  return response.data;
};

export interface PermissionsResponse {
  success: boolean;
  data: Permission[];
}

/**
 * Get all available permissions (hardcoded on backend)
 */
export const getAllPermissions = async (): Promise<PermissionsResponse> => {
  const res = await api.get('/staff/permissions');
  return res.data;
};