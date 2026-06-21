import api from './api';

export type ExpenseCategory = 'rent' | 'utilities' | 'supplies' | 'transport' | 'salaries' | 'marketing' | 'other';

export interface Expense {
  _id: string;
  shop: string;
  category: ExpenseCategory;
  amount: number;
  description?: string;
  date: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpensesResponse {
  success: boolean;
  data: Expense[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ExpenseResponse {
  success: boolean;
  data: Expense;
  message?: string;
}

export interface ExpenseSummary {
  total: number;
  byCategory: { category: ExpenseCategory; amount: number }[];
}

export interface ExpenseSummaryResponse {
  success: boolean;
  data: ExpenseSummary;
}

export interface CreateExpenseData {
  category: ExpenseCategory;
  amount: number;
  description?: string;
  date?: string;
}

export type UpdateExpenseData = Partial<CreateExpenseData>;

/**
 * Get expenses with optional filters (Owner, or staff with 'manage_expenses' permission)
 */
export const getExpenses = async (params?: {
  category?: ExpenseCategory;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<ExpensesResponse> => {
  const response = await api.get('/expenses', { params });
  return response.data;
};

/**
 * Get expense totals for a date range, optionally broken down by category
 */
export const getExpenseSummary = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExpenseSummaryResponse> => {
  const response = await api.get('/expenses/summary', { params });
  return response.data;
};

export const createExpense = async (data: CreateExpenseData): Promise<ExpenseResponse> => {
  const response = await api.post('/expenses', data);
  return response.data;
};

export const updateExpense = async (id: string, data: UpdateExpenseData): Promise<ExpenseResponse> => {
  const response = await api.put(`/expenses/${id}`, data);
  return response.data;
};

export const deleteExpense = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/expenses/${id}`);
  return response.data;
};
