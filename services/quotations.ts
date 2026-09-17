import api from './api';
import type { Sale } from './sales';

/**
 * Service quotations: draft → declined/converted, plus the customer they
 * were drafted for. Mirrors the web client's services/quotations.ts in
 * shape — same field names, since both hit the identical backend endpoints.
 */

export interface QuotationItem {
  /** Present for a catalog line, absent for a free-text custom line. */
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Quotation {
  _id: string;
  customer: string;
  /** Captured at creation time, so a later edit to the Customer record never
   * rewrites a quotation already shared with someone. */
  customerSnapshot: { name: string; phone?: string; email?: string };
  quoteNumber: string;
  items: QuotationItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  validUntil: string;
  status: 'draft' | 'declined' | 'converted';
  convertedSale?: string | null;
  createdBy: string;
  createdByName: string;
  /** Signs into the public /q/[token] view — never a raw customer-facing id. */
  publicToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationInput {
  customerId: string;
  items: {
    productId?: string;
    name?: string;
    description?: string;
    quantity: number;
    /** Required for a custom line (no productId); optional override for a catalog line. */
    unitPrice?: number;
  }[];
  notes?: string;
  /** ISO date string, e.g. '2026-10-17'. */
  validUntil: string;
}

export interface QuotationsResponse {
  success: boolean;
  data: Quotation[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface QuotationResponse {
  success: boolean;
  data: Quotation;
  message?: string;
}

export interface ConvertQuotationPayload {
  paymentMethod: string;
  mpesaTransactionId?: string;
  mpesaReceiptNumber?: string;
}

export interface ConvertQuotationResponse {
  success: boolean;
  data: Sale & { quotationId: string };
  message?: string;
}

/** Owner, or staff with 'create_quotation' (draft/manage) or 'convert_quotation_to_sale' (view only). */
export const getQuotations = async (
  status?: 'draft' | 'declined' | 'converted'
): Promise<QuotationsResponse> => {
  const response = await api.get('/quotations', { params: { status } });
  return response.data;
};

/** Owner, or staff with 'create_quotation'. */
export const createQuotation = async (data: CreateQuotationInput): Promise<QuotationResponse> => {
  const response = await api.post('/quotations', data);
  return response.data;
};

export const declineQuotation = async (id: string): Promise<QuotationResponse> => {
  const response = await api.patch(`/quotations/${id}/decline`);
  return response.data;
};

/** Refused server-side once a quotation has been converted. */
export const deleteQuotation = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/quotations/${id}`);
  return response.data;
};

/**
 * Converts a draft quotation into a real Sale. Requires 'convert_quotation_to_sale',
 * and 'make_credit_sale' too when paymentMethod is the credit key — same gate a
 * till credit sale goes through.
 */
export const convertQuotation = async (
  id: string,
  payload: ConvertQuotationPayload
): Promise<ConvertQuotationResponse> => {
  const response = await api.post(`/quotations/${id}/convert`, payload);
  return response.data;
};
