import api from './api';
import type { CreditAccount, CreditTransaction } from './customers';

/**
 * The shop's credit book: overview, ledger, repayments, corrections, and the
 * one-time import of debts that predate the module.
 */

export interface CreditSettings {
  enabled: boolean;
  defaultCreditLimit: number;
  /** Days until a new credit sale falls due. 0 = same day. */
  defaultCollectionPeriodDays: number;
  productPolicy: 'ALL_PRODUCTS' | 'SELECTED_PRODUCTS';
  /** BLOCK = an overdue customer takes no new credit until they pay something. */
  overduePolicy: 'BLOCK' | 'ALLOW';
}

export interface OverdueCustomer {
  _id: string;
  name: string;
  phone?: string;
  outstanding: number;
  overdueAmount: number;
  dueAt: string | null;
  daysOverdue: number;
}

export interface CreditOverview {
  enabled: boolean;
  settings: CreditSettings;
  totals: {
    totalOutstanding: number;
    totalOverdue: number;
    customersOwing: number;
    customersOverdue: number;
  };
  overdue: OverdueCustomer[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface UntrackedCreditSale {
  _id: string;
  invoiceNumber?: string;
  totalAmount: number;
  createdAt: string;
  staffName: string;
  itemSummary: string;
  itemCount: number;
}

export interface RecordPaymentData {
  amount: number;
  /** A key from the shop's own money-in buttons. Never 'credit'. */
  paymentMethod: string;
  reference?: string;
  note?: string;
}

/** Owner, or staff with 'view_all_credit'. */
export const getCreditOverview = async (params?: {
  page?: number;
  limit?: number;
}): Promise<{ success: boolean; data: CreditOverview }> => {
  const res = await api.get('/credit/overview', { params });
  return res.data;
};

/**
 * The ledger. Narrowed server-side: a staff member without 'view_all_credit'
 * receives only their own entries and `scopedToSelf` comes back true — the
 * device never downloads the whole book to filter it.
 */
export const getCreditTransactions = async (params?: {
  customerId?: string;
  type?: CreditTransaction['type'];
  status?: 'outstanding' | 'paid' | 'reversed';
  overdueOnly?: boolean;
  startDate?: string;
  endDate?: string;
  staffId?: string;
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  data: CreditTransaction[];
  scopedToSelf: boolean;
  pagination: { page: number; limit: number; total: number; pages: number };
}> => {
  const res = await api.get('/credit/transactions', { params });
  return res.data;
};

/**
 * Money in against a debt. Works whether or not credit is currently switched
 * on — a shop that stops lending still has to collect.
 *
 * Realtime-only: a repayment must be verified against the real balance, and a
 * queued one replayed hours later could exceed what is actually owed by then.
 */
export const recordCreditPayment = async (
  customerId: string,
  data: RecordPaymentData
): Promise<{
  success: boolean;
  data: { transaction: CreditTransaction; account: CreditAccount; customerName: string };
  message: string;
}> => {
  const res = await api.post(`/credit/customers/${customerId}/payments`, data, {
    realtimeOnly: true,
  });
  return res.data;
};

/**
 * Owner only. Writes a compensating entry — the original stays in the history
 * with the correction beside it. A reason is required.
 */
export const reverseCreditTransaction = async (
  transactionId: string,
  reason: string
): Promise<{
  success: boolean;
  data: { transaction: CreditTransaction; account: CreditAccount };
  message: string;
}> => {
  const res = await api.post(
    `/credit/transactions/${transactionId}/reverse`,
    { reason },
    { realtimeOnly: true }
  );
  return res.data;
};

/**
 * Owner only. Past sales marked "Credit" from before this module existed —
 * real money someone may still owe, with no record of who.
 */
export const getUntrackedCreditSales = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  data: UntrackedCreditSale[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> => {
  const res = await api.get('/credit/untracked-sales', { params });
  return res.data;
};

/**
 * Owner only. Brings an existing debt onto the books — either by naming the
 * customer on one of the untracked sales above, or by recording a debt that
 * only ever lived on a chalkboard.
 */
export const recordOpeningBalance = async (data: {
  customerId: string;
  amount: number;
  dueAt?: string;
  saleId?: string;
  note?: string;
}): Promise<{
  success: boolean;
  data: { transaction: CreditTransaction; account: CreditAccount };
  message: string;
}> => {
  const res = await api.post('/credit/opening-balances', data, { realtimeOnly: true });
  return res.data;
};
