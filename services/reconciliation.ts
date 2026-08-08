import api from './api';

/**
 * Cashier & financial reconciliation. Owner and staff hit the *same*
 * endpoints — the backend auto-scopes non-owners to their own data when they
 * hold `view_reconciliation`, so there's no separate "my" wrapper.
 */

export type ReconciliationPeriod = 'day' | 'week' | 'month';

export interface CashierReconciliation {
  staffId: string;
  staffName: string;
  shiftsCount: number;
  /** Shifts still open at the end of the range — not yet reflected in the totals below. */
  unclosedCount: number;
  salesCount: number;
  grossSales: number;
  discounts: number;
  byMethod: { cash: number; mpesa: number; card: number };
  refunds: { count: number; total: number };
  voids: { count: number; total: number };
  cashExpensesTotal: number;
  openingFloatTotal: number;
  expectedCashTotal: number;
  actualCashTotal: number;
  cashDiscrepancyTotal: number;
}

export async function getCashierReconciliation(params?: {
  period?: ReconciliationPeriod;
  date?: string;
  startDate?: string;
  endDate?: string;
  staffId?: string;
}): Promise<{
  success: boolean;
  /** False when the shop hasn't switched shift management on — `cashiers` is empty either way. */
  enabled: boolean;
  data: { cashiers: CashierReconciliation[]; period?: ReconciliationPeriod; start: string; end: string };
}> {
  const res = await api.get('/reconciliation/cashiers', { params });
  return res.data;
}

export interface MonthlyFinancialReconciliation {
  revenue: number;
  salesCount: number;
  expenses: number;
  expensesByCategory: { category: string; total: number }[];
  purchases: number;
  purchaseCount: number;
  netCashPosition: number;
  start: string;
  end: string;
}

/** Shop-wide — owner only. */
export async function getMonthlyReconciliation(params?: {
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ success: boolean; data: MonthlyFinancialReconciliation }> {
  const res = await api.get('/reconciliation/monthly', { params });
  return res.data;
}
