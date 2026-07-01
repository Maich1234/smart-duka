export const getErrorMessage = (error: any): string => {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return 'An unexpected error occurred. Please try again.';
};

export const isNetworkError = (error: any): boolean =>
  error.message === 'Network Error' || error.code === 'ECONNABORTED';

export const handleApiError = (error: any, defaultMessage?: string): string => {
  const message = getErrorMessage(error);
  // Never log the raw error object in production — it may contain auth headers
  // or customer phone numbers from request/response bodies.
  if (__DEV__) console.error('[API Error]', message, error);
  return defaultMessage || message;
};

/** True when the request was saved to the offline queue rather than sent. */
export const isOfflineQueued = (error: any): boolean => !!error?.offlineQueued;

/** True when the request requires live connectivity and was rejected offline (e.g. M-Pesa STK push). */
export const isOfflineRealtime = (error: any): boolean => !!error?.offlineRealtime;
