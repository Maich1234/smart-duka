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
 * The DuQana marketing site (`smart-duka-marketing` on Vercel) — the Help &
 * Learning Center (/help), the privacy policy, terms, the public
 * account-deletion page, and Contact all live here, not in the app.
 * Overridable so a preview deployment or a future custom domain doesn't need
 * a code change — set EXPO_PUBLIC_WEB_URL in the EAS build profile.
 *
 * EXPO_PUBLIC_* is inlined at build time, so a localhost value baked into a
 * build (e.g. a development-profile setting bleeding into preview/production
 * on EAS) is rejected here rather than shipping to real devices.
 *
 * No trailing slash: every consumer appends a path beginning with "/".
 */
const configuredWebUrl = process.env.EXPO_PUBLIC_WEB_URL;
export const WEB_URL = (
  configuredWebUrl && !isLocalUrl(configuredWebUrl) ? configuredWebUrl : 'https://duqana.co.ke'
).replace(/\/+$/, '');

// Base URL of the Help & Learning Center. No help content ships in this app on
// any platform — openHelp() always opens the browser (see utils/openHelp.ts).
export const HELP_CENTER_URL = WEB_URL;

/**
 * The dashboard app's own web deployment (`smart-duka-web` on Vercel) — a
 * separate host from the marketing site above. Used for the things that need
 * an authenticated app context rather than a public marketing page: the
 * receipt QR code (/r/<token>) and the setup-guide embed's scoped webview
 * token. Set EXPO_PUBLIC_APP_URL in the EAS build profile to override.
 */
const configuredAppUrl = process.env.EXPO_PUBLIC_APP_URL;
export const PUBLIC_WEB_URL = (
  configuredAppUrl && !isLocalUrl(configuredAppUrl) ? configuredAppUrl : 'https://app.duqana.co.ke'
).replace(/\/+$/, '');

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
