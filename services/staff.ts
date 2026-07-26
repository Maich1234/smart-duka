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
  /** Present when the change moved billable head-count — see SeatBillingNote. */
  billing?: SeatBillingNote | null;
}

export interface CreateStaffData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  permissions?: string[];
}

/**
 * What one more seat will add to the next invoice.
 *
 * Seats used to be prepaid: adding a cashier returned a 409 and demanded an
 * M-Pesa STK push for a *full* billing period, however little of it was left
 * — a full year on annual plans. They're postpaid and prorated now, so this
 * is a disclosure rather than a checkout, and the app carries no purchase
 * flow at all (which is also what keeps it inside Play's payments policy).
 */
export interface SeatPreview {
  willCharge: boolean;
  /** Prorated for the remainder of the current period. */
  amount: number;
  fullPeriodAmount: number;
  currency: string;
  nextInvoiceAt: string | null;
  billingCycle: 'monthly' | 'yearly';
}

/** Returned alongside a created/updated staff member when the bill changed. */
export interface SeatBillingNote {
  addedToNextInvoice: number;
  currency?: string;
  nextInvoiceAt?: string | null;
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
 * What adding one more team member will add to the next invoice.
 *
 * Purely informational — seats are postpaid now, so nothing is charged here
 * and there is no payment step to complete. Shown as a note before the owner
 * commits, so the bill is never a surprise.
 */
export const previewSeatAddition = async (): Promise<SeatPreview> => {
  const response = await api.get('/staff/seat-preview');
  return response.data.data;
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