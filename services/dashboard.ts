import api from './api';

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

export interface OwnerDashboardData {
  todaySalesTotal: number;
  cashSalesTotal: number;
  mpesaSalesTotal: number;
  transactionsToday: number;
  // Optional — added July 2026; older deployed backends won't return these,
  // so every consumer must degrade gracefully when they're undefined.
  yesterdaySalesTotal?: number;
  todayProfit?: number;
  todayExpensesTotal?: number;
  topProduct?: TopProduct | null;
  openShiftsCount?: number;
  totalProducts: number;
  currentStockValue: number;
  lowStockItems: {
    _id: string;
    name: string;
    quantity: number;
    lowStockAlert: number;
  }[];
  recentTransactions: {
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
    staff: { name: string };
  }[];
  ratingSummary: {
    avgStars: number;
    totalRatings: number;
  };
}

export interface StaffDashboardData {
  todaySalesTotal: number;
  cashSalesTotal: number;
  mpesaSalesTotal: number;
  transactionsToday: number;
  /** Optional — older deployed backends won't return this. */
  yesterdaySalesTotal?: number;
  recentSales: {
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
  }[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Get owner dashboard data
 * Requires owner role
 */
export const getOwnerDashboard = async (): Promise<ApiResponse<OwnerDashboardData>> => {
  const response = await api.get('/dashboard/owner');
  return response.data;
};

/**
 * Get staff dashboard data
 * Staff sees only their own performance
 */
export const getStaffDashboard = async (): Promise<ApiResponse<StaffDashboardData>> => {
  const response = await api.get('/dashboard/staff');
  return response.data;
};