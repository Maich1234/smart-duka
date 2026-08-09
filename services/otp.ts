import api from './api';

export type OtpMethod = 'sms' | 'email';

export interface RequestOtpResponse {
  success: boolean;
  data: { sessionId: string; sentTo: string; method: OtpMethod };
  message: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  data: { verificationToken: string };
  message: string;
}

export async function requestOTP(method: OtpMethod): Promise<RequestOtpResponse> {
  // The backend awaits full email delivery before responding (Vercel kills
  // work started after res.json()), and the current mail host routinely
  // takes 26-30s to accept a message — comfortably past the client's global
  // 12s timeout. A per-call override here, not a global timeout bump, keeps
  // every other endpoint's fast-fail behavior intact.
  const res = await api.post('/otp/request', { method }, { timeout: 40000 });
  return res.data;
}

export async function verifyOTP(sessionId: string, code: string): Promise<VerifyOtpResponse> {
  const res = await api.post('/otp/verify', { sessionId, code });
  return res.data;
}
