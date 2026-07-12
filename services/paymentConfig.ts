import api from './api';

export interface MpesaConfigStatus {
  enabled: boolean;
  environment: 'sandbox' | 'production' | null;
  businessName: string | null;
  shortcode: string | null;
  isConfigured: boolean;
  /** True when the initiator credentials needed for M-Pesa refunds are set */
  refundsConfigured?: boolean;
}

export interface MpesaConfigDetails {
  enabled: boolean;
  environment: 'sandbox' | 'production';
  businessName: string;
  shortcode: string;
  consumerKeySet: boolean;
  consumerSecretSet: boolean;
  passkeySet: boolean;
  consumerKeyMasked: string | null;
  consumerSecretMasked: string | null;
  passkeyMasked: string | null;
  /** Refund (Transaction Reversal) credentials */
  initiatorName?: string;
  securityCredentialSet?: boolean;
  securityCredentialMasked?: string | null;
  configuredAt: string | null;
}

export interface SaveMpesaConfigPayload {
  environment: 'sandbox' | 'production';
  businessName: string;
  shortcode: string;
  consumerKey?: string;
  consumerSecret?: string;
  passkey?: string;
  /** Daraja API operator username — required for M-Pesa refunds */
  initiatorName?: string;
  /** RSA-encrypted initiator password generated on the Daraja portal */
  securityCredential?: string;
}

/** Fetches M-Pesa enabled/disabled status — safe for all authenticated users, no credentials. */
export async function getPaymentStatus(): Promise<{ success: boolean; data: { mpesa: MpesaConfigStatus } }> {
  const res = await api.get('/payment-config/status');
  return res.data;
}

/** Fetches masked payment config — requires X-Verification-Token header. */
export async function getPaymentConfig(
  verificationToken: string
): Promise<{ success: boolean; data: { mpesa: MpesaConfigDetails } }> {
  const res = await api.get('/payment-config', {
    headers: { 'X-Verification-Token': verificationToken },
  });
  return res.data;
}

/** Saves M-Pesa credentials (encrypted server-side). Requires verification token. */
export async function saveMpesaConfig(
  payload: SaveMpesaConfigPayload,
  verificationToken: string
): Promise<{ success: boolean; message: string }> {
  const res = await api.put('/payment-config/mpesa', payload, {
    headers: { 'X-Verification-Token': verificationToken },
  });
  return res.data;
}

/** Disconnects M-Pesa integration. Requires verification token. */
export async function disconnectMpesa(
  verificationToken: string
): Promise<{ success: boolean; message: string }> {
  const res = await api.delete('/payment-config/mpesa', {
    headers: { 'X-Verification-Token': verificationToken },
  });
  return res.data;
}
