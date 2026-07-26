import { Linking } from 'react-native';
import { WEB_URL } from '@/constants/config';

export type LegalDocument = 'terms' | 'privacy' | 'delete-account';

/**
 * Opens a legal document in the browser.
 *
 * The documents live on the web front end rather than being duplicated in the
 * app, for the same reason the Help Center does: one copy to keep current. It
 * matters more here — a privacy policy that says something different from the
 * one submitted to the Play Console is a compliance problem, not just a stale
 * page.
 *
 * These are informational links, not payment steering, so they are fine to
 * include in the app (unlike anything pointing at subscription checkout — see
 * app/(owner)/subscription.tsx).
 */
export function openLegal(document: LegalDocument) {
  Linking.openURL(`${WEB_URL}/${document}`);
}
