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
  // services/api.ts's interceptors reject with plain, non-Axios objects in
  // several cases: `{ offlineQueued }` / `{ offlineUnavailable }` from the
  // offline outbox, `{ offlineRealtime }` for REALTIME_ONLY endpoints, and a
  // bare `{ message }` connection error when a request in NEVER_QUEUE (which
  // /otp/request and /otp/verify are) fails mid-flight. None of these ever
  // reached the backend, so none of them mean "wrong code" — without this
  // check they fell through to the generic branch below, which used to
  // discard the real message and could read like a rejected code.
  const queued = err as { offlineQueued?: boolean; offlineUnavailable?: boolean; offlineRealtime?: boolean; message?: string };
  if (queued?.offlineQueued || queued?.offlineUnavailable || queued?.offlineRealtime) {
    return {
      kind: 'offline',
      message: queued.message || "You're offline. Check your connection and try again.",
    };
  }

  const ax = err as AxiosError<{ message?: string }>;
  const serverMsg = ax?.response?.data?.message ?? '';

  if (ax?.code === 'ERR_NETWORK' || (ax?.isAxiosError && !ax.response)) {
    return {
      kind: 'offline',
      message: "You're offline. Check your connection and try again.",
    };
  }
  if (!ax?.isAxiosError && !ax?.response && ax?.message) {
    // The plain connection-error object from the response interceptor's
    // NEVER_QUEUE path (e.g. a client-side timeout despite the extended
    // budget) — same treatment, but keep its specific message.
    return { kind: 'offline', message: ax.message };
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
