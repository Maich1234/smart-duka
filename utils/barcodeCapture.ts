import { router } from 'expo-router';

/**
 * Bridges a scanned code back to whichever screen opened the camera in
 * "capture" mode (currently just ProductForm's barcode field, for "scan to
 * fill"). Expo Router has no return-a-value-from-a-pushed-screen primitive,
 * so this mirrors the in-memory bridge PaymentsSection already uses for its
 * verification token — a module-level callback that's write-once,
 * read-once, and never persisted or logged.
 */
let _onCapture: ((code: string) => void) | null = null;

export function openBarcodeCapture(role: 'owner' | 'staff' | undefined, onCapture: (code: string) => void) {
  _onCapture = onCapture;
  router.push({
    pathname: role === 'staff' ? '/(staff)/scan' : '/(owner)/scan',
    params: { mode: 'capture' },
  });
}

/** Called by BarcodeScannerScreen when a code is captured in capture mode. Returns whether a listener was waiting. */
export function consumeBarcodeCapture(code: string): boolean {
  const cb = _onCapture;
  _onCapture = null;
  if (!cb) return false;
  cb(code);
  return true;
}

/** Clears a pending capture without invoking it — e.g. the user backs out of the scanner. */
export function cancelBarcodeCapture() {
  _onCapture = null;
}
