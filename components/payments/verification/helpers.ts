import type { AxiosError } from 'axios';

/**
 * Error taxonomy for the OTP flow — every failure the user can hit maps to a
 * specific, actionable message instead of surfacing raw server/axios text.
 */
export type OtpErrorKind = 'offline' | 'rate_limit' | 'expired' | 'invalid' | 'generic';

export interface OtpError {
  kind: OtpErrorKind;
  message: string;
}

export function mapOtpError(err: unknown, fallback: string): OtpError {
  const ax = err as AxiosError<{ message?: string }>;
  const serverMsg = ax?.response?.data?.message ?? '';

  if (ax?.code === 'ERR_NETWORK' || (ax?.isAxiosError && !ax.response)) {
    return {
      kind: 'offline',
      message: "You're offline. Check your connection and try again.",
    };
  }
  if (ax?.response?.status === 429 || /too many/i.test(serverMsg)) {
    return {
      kind: 'rate_limit',
      message: serverMsg || 'Too many attempts. Please wait a few minutes and try again.',
    };
  }
  if (/expired/i.test(serverMsg)) {
    return {
      kind: 'expired',
      message: 'That code has expired. Request a new one below.',
    };
  }
  if (/invalid|incorrect/i.test(serverMsg)) {
    return {
      kind: 'invalid',
      message: 'Incorrect code. Check the digits and try again.',
    };
  }
  return { kind: 'generic', message: serverMsg || fallback };
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return 'your phone number';
  const c = phone.replace(/\s/g, '');
  return c.length < 4 ? c : c.slice(0, -3).replace(/\d/g, '•') + c.slice(-3);
}

export function maskEmail(email?: string | null): string {
  if (!email) return 'your email';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = '•'.repeat(Math.min(Math.max(1, local.length - 1), 8));
  return `${local[0]}${masked}@${domain}`;
}
