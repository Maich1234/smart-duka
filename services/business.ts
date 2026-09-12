import api from './api';

/**
 * Owner Business Overview — the read side.
 *
 * Every figure here is computed by the backend. Nothing on this screen
 * re-derives revenue, cost or profit from raw records on the device: the
 * server holds the cost snapshots and the sale-status rules, and a second
 * implementation on the client is a second answer waiting to disagree.
 */

/** Windows the server understands. `custom` requires startDate + endDate. */
export type BusinessPeriod = 'today' | 'week' | 'month' | 'last_month' | 'custom';

export type ProductSort =
  | 'most_sold' | 'least_sold'
  | 'highest_revenue' | 'lowest_revenue'
  | 'highest_profit' | 'lowest_profit';

export type StaffSort = 'revenue' | 'transactions' | 'average';

export interface PeriodParams {
  period: BusinessPeriod;
  /** YYYY-MM-DD, required when period is 'custom'. */
  startDate?: string;
  endDate?: string;
}

export interface CapitalComponent {
  key: 'inventory' | 'assets' | 'other_funds' | 'liabilities';
  label: string;
  /** null when DuQana doesn't record this — never render it as 0. */
  amount: number | null;
  recorded: boolean;
  reason?: string;
}

export interface InventoryValuation {
  stockAtCost: number;
  potentialSalesValue: number;
  potentialMargin: number;
  productCount: number;
}

export interface CapitalPosition {
  components: CapitalComponent[];
  estimatedPosition: number;
  inventory: InventoryValuation;
  assets: {
    estimatedValue: number;
    acquisitionValue: number;
    count: number;
    /** Assets standing at their purchase price because no current value was given. */
    unvaluedCount: number;
  };
  disclaimer: string;
}

export interface TrendPointDto {
  label: string;
  date: string;
  total: number;
  transactionCount: number;
}

export interface ProductRow {
  productId: string;
  name: string;
  units: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPercent: number;
  stockOnHand: number;
  /** Days this product existed inside the selected period. */
  availableDays: number;
  availableWholePeriod: boolean;
  /** Cost was reconstructed, not captured at sale time — label it as an estimate. */
  costEstimated: boolean;
  inCatalogue: boolean;
}

export interface ProductHighlights {
  topUnits: ProductRow | null;
  topRevenue: ProductRow | null;
  topProfit: ProductRow | null;
}

export interface BusinessOverview {
  capital: CapitalPosition;
  inventory: InventoryValuation & { lowStockCount: number };
  today: { total: number; transactions: number };
  month: {
    period: BusinessPeriod;
    startDate: string;
    endDate: string;
    total: number;
    transactions: number;
    averageSale: number;
    grossProfit: number;
    costEstimated: boolean;
    series: TrendPointDto[];
    highlights: ProductHighlights;
  };
}

export interface BusinessSales {
  period: BusinessPeriod;
  startDate: string;
  endDate: string;
  total: number;
  transactions: number;
  averageSale: number;
  byMethod: { key: string; label: string; total: number; transactions: number; sharePercent: number }[];
  series: TrendPointDto[];
}

export interface StaffRow {
  staffId: string;
  name: string;
  revenue: number;
  transactions: number;
  averageSale: number;
  commission: number;
  sharePercent: number;
}

export interface BusinessStaff {
  period: BusinessPeriod;
  startDate: string;
  endDate: string;
  sort: StaffSort;
  staff: StaffRow[];
  totals: { revenue: number; transactions: number; sellers: number };
}

export interface BusinessProducts {
  period: BusinessPeriod;
  startDate: string;
  endDate: string;
  sort: ProductSort;
  rows: ProductRow[];
  highlights: ProductHighlights;
  totals: {
    units: number;
    revenue: number;
    cost: number;
    grossProfit: number;
    productsSold: number;
    productCount: number;
    costEstimated: boolean;
  };
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const getBusinessOverview = async (): Promise<{ success: boolean; data: BusinessOverview }> => {
  const response = await api.get('/business/overview');
  return response.data;
};

export const getBusinessSales = async (params: PeriodParams): Promise<{ success: boolean; data: BusinessSales }> => {
  const response = await api.get('/business/sales', { params });
  return response.data;
};

export const getBusinessStaff = async (
  params: PeriodParams & { sort?: StaffSort },
): Promise<{ success: boolean; data: BusinessStaff }> => {
  const response = await api.get('/business/staff', { params });
  return response.data;
};

export const getBusinessProducts = async (
  params: PeriodParams & { sort?: ProductSort; page?: number; limit?: number },
): Promise<{ success: boolean; data: BusinessProducts }> => {
  const response = await api.get('/business/products', { params });
  return response.data;
};
