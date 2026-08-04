import api from './api';
import { getDeviceInfo } from '../utils/deviceId';

// The two endpoints that hold the connection open while an SMTP handoff
// completes. The client default (12s) is sized for a normal API round trip and
// cuts these off mid-send — the account is created but the app reports a
// network failure, so the user retries onto "email already registered".
// Registration and resend are one-off, deliberate actions, so they can afford
// to wait out a slow mail host rather than lie about the outcome.
const MAIL_TIMEOUT_MS = 45000;

export interface LoginResponse {
  success: boolean;
  data: {
    _id: string;
    name: string;
    email: string;
    role: 'owner' | 'staff';
    token: string;
    /** Rotating 30-day refresh token — exchanged at POST /auth/refresh. */
    refreshToken?: string;
    shop: {
      _id: string;
      name: string;
    };
  };
  message?: string;
}

export interface RegisterData {
  /**
   * Consent to the Terms of Service and Privacy Policy. The server rejects
   * registration without it and records the accepted version against the
   * user, so this is evidence rather than a UI formality.
   */
  acceptedTerms: boolean;
  name: string;
  email: string;
  password: string;
  shopName: string;
  address?: string;
  phone?: string;
}

export interface RegisterResponse {
  success: boolean;
  /**
   * False when the account was created but the verification email could not be
   * handed to the mail server. The code still exists server-side, so "resend"
   * is the recovery path — not re-registering.
   */
  emailSent?: boolean;
  message?: string;
}

export interface ProfileResponse {
  success: boolean;
  data: {
    _id: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    shop: {
      _id: string;
      name: string;
      address?: string;
      phone?: string;
    };
  };
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface VerifyOtpData {
  email: string;
  otp: string;
}

export interface ResetPasswordData {
  email: string;
  newPassword: string;
}

export interface VerifyEmailData {
  email: string;
  code: string;
}

/**
 * Login with email and password
 */
export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const device = await getDeviceInfo();
  const response = await api.post('/auth/login', { email, password, device });
  return response.data;
};

/**
 * Register a new owner with shop
 */
export const register = async (data: RegisterData): Promise<RegisterResponse> => {
  const response = await api.post('/auth/register', data, { timeout: MAIL_TIMEOUT_MS });
  return response.data;
};

/**
 * Get current user profile
 */
export const getProfile = async (): Promise<ProfileResponse> => {
  const response = await api.get('/auth/profile');
  return response.data;
};

/**
 * Update user profile
 */
export const updateProfile = async (data: { name?: string; email?: string; phone?: string }) => {
  const response = await api.put('/auth/profile', data);
  return response.data;
};

/**
 * Change password (authenticated users)
 */
export const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await api.post('/auth/change-password', { currentPassword, newPassword });
  return response.data;
};

/**
 * Request OTP for password reset
 */
export const forgotPassword = async (email: string) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data;
};

/**
 * Verify OTP for password reset
 */
export const verifyOtp = async (email: string, otp: string) => {
  const response = await api.post('/auth/verify-otp', { email, otp });
  return response.data;
};

/**
 * Reset password after OTP verification
 */
export const resetPassword = async (email: string, otp: string, newPassword: string) => {
  const response = await api.post('/auth/reset-password', { email, otp, newPassword });
  return response.data;
};

/**
 * Verify email address with code sent at registration
 */
export const verifyEmail = async (email: string, code: string) => {
  const response = await api.post('/auth/verify-email', { email, code });
  return response.data;
};

/**
 * Resend the email verification code
 */
export const resendVerificationEmail = async (email: string) => {
  const response = await api.post('/auth/resend-verification-email', { email }, { timeout: MAIL_TIMEOUT_MS });
  return response.data;
};

export interface AccountDeletionPreview {
  role: 'owner' | 'staff';
  /** True when deleting also destroys the shop and every staff account in it. */
  cascades: boolean;
  staffAccountsRemoved: number;
  shopName: string | null;
  retainedForBookkeeping: string[];
  /** Length of the cooling-off window before anything is actually destroyed. */
  graceDays: number;
  /** Set when a closure is already scheduled. */
  deletionScheduledAt: string | null;
  /** True for staff: the shop owner signs off before the closure is scheduled. */
  requiresOwnerApproval: boolean;
  /** How long the owner has to answer before the request proceeds anyway. */
  approvalWindowDays: number;
  /** A staff request is recorded and sitting with the owner. */
  awaitingOwnerApproval: boolean;
  deletionRequestedAt: string | null;
}

/**
 * What deleting this account will actually destroy. Owners are usually
 * unaware that it takes their whole team and shop with it, so the
 * confirmation screen states real consequences rather than a generic warning.
 */
export const previewAccountDeletion = async (): Promise<AccountDeletionPreview> => {
  const response = await api.get('/auth/me/deletion-preview');
  return response.data.data;
};

/**
 * Schedules account closure. Required in-app by Google Play policy for any
 * app that offers account creation.
 *
 * Nothing is destroyed immediately: the account keeps working through a
 * 14-day cooling-off window and can be restored with cancelAccountDeletion.
 * Password-gated plus a typed confirmation — a borrowed unlocked phone must
 * not be able to destroy a business.
 *
 * For staff this only *files* the request: the shop owner approves it before
 * the cooling-off clock starts, signalled by `awaitingOwnerApproval` and a
 * null `deletionScheduledAt` in the response.
 */
export const deleteAccount = async (
  password: string,
): Promise<{
  success: boolean;
  message: string;
  data: {
    deletionScheduledAt: string | null;
    graceDays: number;
    awaitingOwnerApproval?: boolean;
    deletionRequestedAt?: string;
    approvalWindowDays?: number;
  };
}> => {
  const response = await api.delete('/auth/me', { data: { password, confirm: 'DELETE' } });
  return response.data;
};

/**
 * Calls off a scheduled closure, or withdraws a staff request the owner
 * hasn't answered yet. No password: the user is already signed in, and
 * backing out of a destructive action should be effortless.
 */
export const cancelAccountDeletion = async (): Promise<{ success: boolean; message: string }> => {
  const response = await api.post('/auth/me/restore');
  return response.data;
};
