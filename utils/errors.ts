import { Alert } from 'react-native';

export const getErrorMessage = (error: any): string => {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return 'An unexpected error occurred. Please try again.';
};

export const isNetworkError = (error: any): boolean =>
  error.message === 'Network Error' || error.code === 'ECONNABORTED';

export const handleApiError = (error: any, defaultMessage?: string): void => {
  const message = getErrorMessage(error);
  console.error('[API Error]', message, error);
  Alert.alert('Error', defaultMessage || message);
};
