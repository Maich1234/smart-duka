import api from './api';

/**
 * Customers, and their credit account with this shop.
 *
 * A customer record belongs to exactly one shop — the same person shopping at
 * two dukas is two independent records — so every endpoint here is already
 * scoped server-side and nothing sends a shopId.
 */

/** Server-computed. Never derived on the device: these decide whether a sale happens. */
export interface CreditAccount {
  creditLimit: number;
  /** 'shop' = following the shop default; 'customer' = a limit set for this person. */
  creditLimitSource: 'shop' | 'customer';
  outstanding: number;
  availableCredit: number;
  overdueAmount: number;
  oldestDueAt: string | null;
  /** Whole days past oldestDueAt, computed server-side. 0 when not overdue. */
  daysOverdue: number;
  status: 'none' | 'current' | 'overdue' | 'paid';
  blocked: boolean;
  blockedReason: string;
  totalExtended: number;
  totalRepaid: number;
  lastSaleAt: string | null;
  lastPaymentAt: string | null;
  /** When a sale rung up right now would fall due. */
  dueAtPreview: string;
  /** Whether the till would accept a credit sale for this customer at all. */
  canTakeCredit: boolean;
}

export interface Customer {
  _id: string;
  shop: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive: boolean;
  /** Absent for a viewer without permission to see credit — never assume it's there. */
  account?: CreditAccount;
  createdAt: string;
  updatedAt: string;
}

export type CreditTransactionType =
  | 'CREDIT_SALE'
  | 'CREDIT_PAYMENT'
  | 'CREDIT_SALE_REVERSAL'
  | 'CREDIT_PAYMENT_REVERSAL'
  | 'CREDIT_OPENING_BALANCE';

export interface CreditTransaction {
  _id: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  /** Debt rows only: how much of this one is still unpaid. */
  outstanding?: number;
  dueAt?: string;
  status?: 'outstanding' | 'paid' | 'reversed';
  overdueAt?: string | null;
  sale?: string;
  paymentMethod?: string;
  paymentMethodLabel?: string;
  reference?: string;
  reversalOf?: string | null;
  reversedBy?: string | null;
  reason?: string;
  staffName?: string;
  customer?: { _id: string; name: string; phone?: string } | string;
  createdAt: string;
}

export interface CustomerSaleSummary {
  _id: string;
  invoiceNumber?: string;
  totalAmount: number;
  paymentMethod: string;
  paymentMethodLabel?: string;
  status: string;
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  transactions: CreditTransaction[];
  recentSales: CustomerSaleSummary[];
  /** True when the timeline is only this user's own entries — say so in the UI. */
  scopedToSelf: boolean;
  pagination?: { page: number; limit: number; total: number; pages: number };
}

export interface CustomersResponse {
  success: boolean;
  data: Customer[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export type CustomerFilter = 'all' | 'outstanding' | 'overdue' | 'paid';

export interface CustomerQuery {
  search?: string;
  filter?: CustomerFilter;
  sort?: 'name' | 'outstanding' | 'recent';
  includeArchived?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateCustomerData {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  /** Owner only — a staff member's value is dropped and the shop default applies. */
  creditLimit?: number | null;
}

export interface UpdateCustomerData {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  /** Owner only. Sending these as staff is refused outright, not ignored. */
  creditLimit?: number | null;
  creditBlocked?: boolean;
  creditBlockedReason?: string;
}

/** Owner, or staff who can sell on credit, take repayments, view credit, or record sales. */
export const getCustomers = async (params?: CustomerQuery): Promise<CustomersResponse> => {
  const res = await api.get('/customers', { params });
  return res.data;
};

/**
 * The account screen's whole payload: the balance, the timeline and recent
 * purchases. The timeline is narrowed server-side for a staff member who may
 * only see their own entries — `scopedToSelf` says when that happened.
 */
export const getCustomerById = async (
  id: string,
  params?: { page?: number; limit?: number }
): Promise<{ success: boolean; data: CustomerDetail }> => {
  const res = await api.get(`/customers/${id}`, { params });
  return res.data;
};

export const createCustomer = async (
  data: CreateCustomerData
): Promise<{ success: boolean; data: Customer }> => {
  const res = await api.post('/customers', data);
  return res.data;
};

export const updateCustomer = async (
  id: string,
  data: UpdateCustomerData
): Promise<{ success: boolean; data: Customer }> => {
  const res = await api.put(`/customers/${id}`, data);
  return res.data;
};

/** Owner only. Refused while the customer still owes money — history is never deleted. */
export const archiveCustomer = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  const res = await api.delete(`/customers/${id}`);
  return res.data;
};
