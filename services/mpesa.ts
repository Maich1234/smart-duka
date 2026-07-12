import api from './api';

export type MpesaTransactionStatus = 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout';

export interface MpesaTransactionStatusResponse {
  success: boolean;
  data: {
    transactionId: string;
    status: MpesaTransactionStatus;
    mpesaReceiptNumber: string | null;
    phoneNumber: string;
    amount: number;
    errorMessage: string | null;
  };
}

export interface InitiateSTKPushResponse {
  success: boolean;
  data: {
    transactionId: string;
    checkoutRequestId: string;
    status: 'pending';
  };
  message: string;
}
export interface MpesaTransaction {
  _id: string;
  shop: string;
  saleId?: { _id: string; invoiceNumber: string; totalAmount: number } | null;
  phoneNumber: string;
  amount: number;
  status: MpesaTransactionStatus;
  mpesaReceiptNumber: string | null;
  transactionDate: string | null;
  errorMessage: string | null;
  accountReference: string | null;
  requestedBy: { _id: string; name: string; email: string } | null;
  createdAt: string;
}

export async function initiateSTKPush(
  phoneNumber: string,
  amount: number,
  accountReference?: string,
  idempotencyKey?: string
): Promise<InitiateSTKPushResponse & { idempotent?: boolean }> {
  const res = await api.post(
    '/mpesa/initiate',
    { phoneNumber, amount, accountReference },
    idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined
  );
  return res.data;
}

export async function getTransactionStatus(transactionId: string): Promise<MpesaTransactionStatusResponse> {
  const res = await api.get(`/mpesa/status/${transactionId}`);
  return res.data;
}

export interface VerifyReceiptResponse {
  success: boolean;
  data: {
    transactionId: string;
    status: MpesaTransactionStatus;
    mpesaReceiptNumber: string;
    phoneNumber: string;
    amount: number;
    accountReference: string | null;
    saleId: string | null;
    transactionDate: string | null;
    createdAt: string;
    requestedBy: { _id: string; name: string; email: string } | null;
  };
  message: string;
}

/** Looks up a transaction by M-Pesa receipt number (the code on the customer's confirmation SMS). */
export async function verifyByReceiptNumber(receiptNumber: string): Promise<VerifyReceiptResponse> {
  const res = await api.post('/mpesa/verify-receipt', { receiptNumber });
  return res.data;
}

export async function getMpesaTransactions(params?: {
  startDate?: string;
  endDate?: string;
  status?: MpesaTransactionStatus;
  staffId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  data: MpesaTransaction[];
  stats: { totalVolume: number; successRate: number; successCount: number; totalCount: number };
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const res = await api.get('/mpesa/transactions', { params });
  return res.data;
}

export async function getMpesaTransactionById(id: string): Promise<{ success: boolean; data: MpesaTransaction }> {
  const res = await api.get(`/mpesa/transactions/${id}`);
  return res.data;
}
