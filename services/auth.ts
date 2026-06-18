import api from './api';

export interface LoginResponse {
  success: boolean;
  data: {
    _id: string;
    name: string;
    email: string;
    role: 'owner' | 'staff';
    token: string;
    shop: {
      _id: string;
      name: string;
    };
  };
  message?: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  shopName: string;
  address?: string;
  phone?: string;
}

export interface RegisterResponse {
  success: boolean;
  data: {
    _id: string;
    name: string;
    email: string;
    role: string;
    token: string;
    shop: { _id: string; name: string };
  };
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
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

/**
 * Register a new owner with shop
 */
export const register = async (data: RegisterData): Promise<RegisterResponse> => {
  const response = await api.post('/auth/register', data);
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
export const resetPassword = async (email: string, newPassword: string) => {
  const response = await api.post('/auth/reset-password', { email, newPassword });
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
  const response = await api.post('/auth/resend-verification-email', { email });
  return response.data;
};
