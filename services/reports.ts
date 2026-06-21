import api from './api';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface ReportBucket {
  label: string;
  date: string;
  total: number;
  cashTotal: number;
  mpesaTotal: number;
  transactionCount: number;
}

export interface ReportSummary {
  totalRevenue: number;
  totalTransactions: number;
  cashTotal: number;
  mpesaTotal: number;
  averageSale: number;
}

export interface TopProduct {
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface StaffPerformance {
  staffName: string;
  total: number;
  transactionCount: number;
}

export interface RatingSummary {
  avgStars: number;
  totalRatings: number;
}

export interface SalesReportData {
  period: ReportPeriod;
  rangeStart: string;
  summary: ReportSummary;
  series: ReportBucket[];
  topProducts: TopProduct[];
  byStaff: StaffPerformance[];
  ratingSummary: RatingSummary;
}

export interface SalesReportResponse {
  success: boolean;
  data: SalesReportData;
}

/**
 * Get daily/weekly/monthly sales report (Owner only)
 */
export const getSalesReport = async (period: ReportPeriod): Promise<SalesReportResponse> => {
  const response = await api.get('/reports/sales', { params: { period } });
  return response.data;
};
