import api from './api';

export interface BusinessSnapshotTotals {
  revenue: number;
  profit: number;
  expenses: number;
}

export interface BusinessSnapshot {
  version: number;
  generatedAt: string;
  business: { name: string | null; address: string | null; country: string | null };
  today: {
    revenue: number;
    profit: number;
    expenses: number;
    transactions: number;
    topProduct: { name: string; quantity: number; revenue: number } | null;
  };
  trend: { week: BusinessSnapshotTotals; month: BusinessSnapshotTotals };
  inventory: { stockValue: number; lowStockCount: number; fastMovers: string[]; slowMovers: string[] };
  payments: Record<string, { count: number; total: number }>;
  staff: { staffId: string; name: string; salesCount: number; revenue: number }[];
  health: {
    score: number;
    components: { revenue: number; profit: number; inventory: number; cashFlow: number; staff: number };
  };
  alerts: { type: string; severity: 'critical' | 'warning' | 'info'; message: string }[];
  insights: string[];
}

export interface AiInsight {
  summary: string;
  priority: 'low' | 'medium' | 'high';
  actions: string[];
  health: number;
  source: 'gemini' | 'fallback' | 'cache';
}

export interface AiInsightData {
  snapshot: BusinessSnapshot;
  insight: AiInsight;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** GET /ai/insight — the day's BusinessSnapshot plus a Gemini-generated explanation. 403s if the shop's plan doesn't include ai_insights. */
export const getAiInsight = async (): Promise<ApiResponse<AiInsightData>> => {
  const response = await api.get('/ai/insight');
  return response.data;
};
