import { Colors } from './Colors';
import { Spacing } from './Spacing';
import { Typography } from './Typography';
import { Shadows } from './Shadows';

export { Colors, Spacing, Typography, Shadows };

export const API_BASE_URL = 'https://smart-duka-backend-iota.vercel.app/api/v1';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

// Hermes has no built-in `URL` global, so this checks the hostname with a
// regex rather than parsing — good enough for the http(s) values this ever
// sees, without pulling in a polyfill for one guard.
const isLocalUrl = (value: string): boolean => {
  const match = /^https?:\/\/([^/:?#]+)/i.exec(value.trim());
  return !match || LOCAL_HOSTNAMES.has(match[1].toLowerCase());
};

/**
 * The DuQana web front end (the `smart-duka-web` Next.js app on Vercel).
 *
 * One host serves everything the app links out to: the Help & Learning
 * Center (/help), public receipts (/r/<token>), the privacy policy, terms,
 * and the public account-deletion page. Overridable so a preview deployment
 * or a future custom domain doesn't need a code change — set
 * EXPO_PUBLIC_WEB_URL in the EAS build profile.
 *
 * EXPO_PUBLIC_* is inlined at build time, so a localhost value baked into a
 * build (e.g. a development-profile setting bleeding into preview/production
 * on EAS) is rejected here rather than shipping to real devices.
 *
 * No trailing slash: every consumer appends a path beginning with "/".
 */
const configuredWebUrl = process.env.EXPO_PUBLIC_WEB_URL;
export const WEB_URL = (
  configuredWebUrl && !isLocalUrl(configuredWebUrl) ? configuredWebUrl : 'https://duqana.app'
).replace(/\/+$/, '');

// Used to build the QR code link on receipts. Points at the Next.js app's
// /r/[token] route — previously the Expo web export, which is no longer where
// public pages live.
export const PUBLIC_WEB_URL = WEB_URL;

// Base URL of the Help & Learning Center. No help content ships in this app on
// any platform — openHelp() always opens the browser (see utils/openHelp.ts).
export const HELP_CENTER_URL = WEB_URL;

// Matches app.json's "scheme" — used to deep-link from the web verification
// page into the native app when it's installed (falls back to the web page
// itself, which is already loaded, if it isn't).
export const APP_SCHEME = 'duqana';

// Founder's handwritten e-signature (transparent PNG) — shown under the
// founder's note at the end of onboarding. The w_280,q_auto Cloudinary
// transform serves a ~10 KB render-sized copy (2× the 140pt display width)
// instead of the 120 KB original.
export const CEO_SIGN_IMG_URL =
  'https://res.cloudinary.com/dwdhxgvsl/image/upload/w_280,q_auto/v1783716945/e-sign-removebg-preview_lvulz8.png';

export const APP_NAME = 'DuQana';
export const APP_VERSION = '1.0.0';

export const PAYMENT_METHODS = [
  { label: 'Cash', value: 'cash' },
  { label: 'M-Pesa', value: 'mpesa' },
] as const;

export const DEFAULT_LOW_STOCK_ALERT = 5;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
