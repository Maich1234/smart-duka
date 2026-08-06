import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';

export interface ShiftMethodTotals {
  count: number;
  total: number;
}

export interface ShiftSummary {
  salesCount: number;
  grossSales: number;
  discounts: number;
  byMethod: {
    cash: ShiftMethodTotals;
    mpesa: ShiftMethodTotals;
    card: ShiftMethodTotals;
  };
  refunds: { count: number; total: number; cashTotal: number };
  voids: { count: number; total: number };
  cashExpenses: { count: number; total: number };
  stockAdjustments: number;
  expectedCash: number;
  cashDiscrepancy: number | null;
  durationMinutes?: number;
}

export interface Shift {
  _id: string;
  shop: string;
  staff: string | { _id: string; name: string };
  status: 'active' | 'closed';
  startedAt: string;
  endedAt?: string;
  endedBy?: string | { _id: string; name: string };
  device?: { platform?: string; name?: string; appVersion?: string };
  openingFloat: number;
  closingCount?: number;
  openingNote?: string;
  closingNote?: string;
  summary?: ShiftSummary;
}

export interface DailySummaryData {
  _id: string;
  date: string;
  totals: {
    revenue: number;
    transactions: number;
    discounts: number;
    grossProfit: number;
    expenses: number;
  };
  byMethod: {
    cash?: ShiftMethodTotals;
    mpesa?: ShiftMethodTotals;
    card?: ShiftMethodTotals;
  };
  refunds: { count: number; total: number };
  voids: { count: number; total: number };
  shifts: { count: number; totalDiscrepancy: number; unclosed: number };
  inventory: { lowStockCount: number; adjustments: number; stockValue: number };
  bestSellers: { productId: string; name: string; quantity: number; revenue: number }[];
  slowMovers: { productId: string; name: string; quantity: number; stock: number }[];
  staffPerformance: { staffId: string; name: string; salesCount: number; revenue: number }[];
  mpesaReconciliation: { salesTotal: number; confirmedTotal: number; delta: number };
  insights: string[];
  generatedAt: string;
}

/** Captured at shift start so reports show which device ran the till. */
const deviceInfo = () => ({
  platform: Platform.OS,
  name: Constants.deviceName ?? undefined,
  appVersion: Constants.expoConfig?.version ?? undefined,
});

export const getActiveShift = async (): Promise<{
  success: boolean;
  data: Shift | null;
  enabled: boolean;
}> => {
  const res = await api.get('/shifts/active');
  return res.data;
};

/**
 * True when the server rejected the request purely because it doesn't know a
 * field this build sends. Joi's `stripUnknown` does not override an explicit
 * `.unknown(false)`, so a backend older than the app answers 400 "Validation
 * error" for the whole request instead of ignoring the field.
 */
const rejectsUnknownField = (error: any, field: string): boolean => {
  if (error?.response?.status !== 400) return false;
  const details = error.response.data?.errors;
  return (
    Array.isArray(details) &&
    details.length === 1 &&
    typeof details[0] === 'string' &&
    details[0].includes(field) &&
    details[0].includes('not allowed')
  );
};

export const startShift = async (payload: {
  openingFloat: number;
  openingNote?: string;
}): Promise<{ success: boolean; data: Shift; message?: string }> => {
  // startedAt is stamped here, not on the server: offline this request sits in
  // the outbox until the network returns, and a shift dated by its own sync
  // would report the wrong duration and reconciliation window. The server
  // clamps the value it accepts.
  const body = {
    ...payload,
    startedAt: new Date().toISOString(),
    device: deviceInfo(),
  };

  try {
    const res = await api.post('/shifts/start', body);
    return res.data;
  } catch (error: any) {
    // A backend that predates startedAt fails the whole request rather than
    // ignoring the field, which locks the till and stops the shop selling until
    // a deploy lands. The timestamp only earns its keep for a shift replayed
    // from the outbox — sent live it is already ~now — so give up the field
    // rather than the shift. Each api.post carries its own idempotency key, so
    // this retry is not replayed as the stored 400.
    if (rejectsUnknownField(error, 'startedAt')) {
      const { startedAt: _startedAt, ...legacyBody } = body;
      const res = await api.post('/shifts/start', legacyBody);
      return res.data;
    }
    throw error;
  }
};

/** Pass 'current' to close the caller's own active shift. */
export const endShift = async (
  id: string,
  payload: { closingCount?: number; closingNote?: string }
): Promise<{ success: boolean; data: Shift; message?: string }> => {
  const res = await api.post(`/shifts/${id}/end`, payload);
  return res.data;
};

export const getShifts = async (params?: {
  staffId?: string;
  status?: 'active' | 'closed';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  data: Shift[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> => {
  const res = await api.get('/shifts', { params });
  return res.data;
};

export const getShiftById = async (
  id: string
): Promise<{ success: boolean; data: Shift; liveSummary: ShiftSummary | null }> => {
  const res = await api.get(`/shifts/${id}`);
  return res.data;
};

export const getDailySummary = async (
  date: string
): Promise<{ success: boolean; data: DailySummaryData }> => {
  const res = await api.get(`/summaries/daily/${date}`);
  return res.data;
};

export const listDailySummaries = async (params?: {
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  data: DailySummaryData[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> => {
  const res = await api.get('/summaries/daily', { params });
  return res.data;
};
