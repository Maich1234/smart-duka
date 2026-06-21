import api from './api';

export type Movement = 'fast' | 'medium' | 'slow' | 'dead';

export interface DepletionItem {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  lowStockAlert: number;
  unitsSold: number;
  avgDailyVelocity: number;
  daysUntilStockout: number | null;
  movement: Movement;
}

export interface DepletionAnalytics {
  windowDays: number;
  items: DepletionItem[];
  fastMovers: DepletionItem[];
  slowMovers: DepletionItem[];
  stockoutSoon: DepletionItem[];
}

export interface DepletionResponse {
  success: boolean;
  data: DepletionAnalytics;
}

/**
 * Get inventory depletion analytics — sales velocity, predicted stockout
 * dates, and fast/slow mover classification (Owner only)
 */
export const getDepletionAnalytics = async (windowDays?: number): Promise<DepletionResponse> => {
  const response = await api.get('/analytics/depletion', { params: windowDays ? { windowDays } : undefined });
  return response.data;
};
