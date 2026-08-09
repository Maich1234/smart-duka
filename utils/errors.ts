export const isNetworkError = (error: any): boolean =>
  error.message === 'Network Error' || error.code === 'ECONNABORTED';

/** True when the request was saved to the offline queue rather than sent. */
export const isOfflineQueued = (error: any): boolean => !!error?.offlineQueued;

/**
 * True when the device is offline AND could not save the operation locally —
 * the write is genuinely lost. Distinct from `isOfflineQueued`, which means
 * the opposite: it was saved and will sync. Callers must not show a reassuring
 * "saved offline" message for this case.
 */
export const isOfflineUnavailable = (error: any): boolean => !!error?.offlineUnavailable;

/**
 * Message for a failed mutation: the server's own wording where there is one,
 * otherwise `fallback`.
 *
 * Offline-storage-unavailable errors are surfaced verbatim — they carry no
 * HTTP response, so the generic fallback ("Could not save…") would hide the
 * one thing the user needs to know: that nothing was stored and reconnecting
 * is the only way through.
 */
export const mutationErrorMessage = (error: any, fallback: string): string => {
  if (isOfflineUnavailable(error)) return error.message;
  return error?.response?.data?.message || fallback;
};
