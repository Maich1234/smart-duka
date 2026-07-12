import api from './api';

export interface Rating {
  _id: string;
  shop: string;
  sale: { _id: string; invoiceNumber: string; totalAmount: number; createdAt: string } | string;
  staff: { _id: string; name: string } | string;
  stars: number;
  comment?: string;
  createdAt: string;
}

export interface RatingsResponse {
  success: boolean;
  data: Rating[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface RatingsSummary {
  avgStars: number;
  totalRatings: number;
  distribution: { stars: number; count: number }[];
  byStaff: { staffId: string; staffName: string; avgStars: number; totalRatings: number }[];
}

export interface RatingsSummaryResponse {
  success: boolean;
  data: RatingsSummary;
}

export interface PublicReceipt {
  invoiceNumber: string;
  shopName: string;
  currency: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  alreadyRated: boolean;
  rating: { stars: number; comment?: string } | null;
}

export interface PublicReceiptResponse {
  success: boolean;
  data: PublicReceipt;
  message?: string;
}

/**
 * Get ratings list (Owner only)
 */
export const getRatings = async (params?: {
  staffId?: string;
  stars?: number;
  page?: number;
  limit?: number;
}): Promise<RatingsResponse> => {
  const response = await api.get('/ratings', { params });
  return response.data;
};

/**
 * Get ratings summary — averages, distribution, per-staff breakdown (Owner only)
 */
export const getRatingsSummary = async (): Promise<RatingsSummaryResponse> => {
  const response = await api.get('/ratings/summary');
  return response.data;
};

/**
 * Fetch a receipt for public verification by its QR token (no auth)
 */
export const getPublicReceipt = async (token: string): Promise<PublicReceiptResponse> => {
  const response = await api.get(`/public/receipt/${token}`);
  return response.data;
};

/**
 * Submit a customer rating for a receipt by its QR token (no auth)
 */
export const submitPublicRating = async (
  token: string,
  data: { stars: number; comment?: string }
): Promise<{ success: boolean; data: Rating; message?: string }> => {
  const response = await api.post(`/public/receipt/${token}/rating`, data);
  return response.data;
};
