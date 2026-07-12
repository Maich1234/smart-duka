/**
 * UUID v4 generator — uses crypto.randomUUID when the runtime provides it,
 * falls back to a Math.random implementation. Hermes has no WebCrypto and
 * expo-crypto isn't bundled, so the fallback is the common path on native
 * (and on web served over plain http, where randomUUID is secure-context
 * only). These IDs key idempotency headers and offline-queue rows — they
 * need uniqueness, not cryptographic strength.
 */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
