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
  const res = await api.post('/otp/request', { method });
  return res.data;
}

export async function verifyOTP(sessionId: string, code: string): Promise<VerifyOtpResponse> {
  const res = await api.post('/otp/verify', { sessionId, code });
  return res.data;
}
