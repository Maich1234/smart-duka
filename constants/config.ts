import { Colors } from './Colors';
import { Spacing } from './Spacing';
import { Typography } from './Typography';
import { Shadows } from './Shadows';

export { Colors, Spacing, Typography, Shadows };

export const API_BASE_URL = 'https://smart-duka-backend-iota.vercel.app/api/v1';

// Base URL of the deployed public web export — used to build the QR code
// link on receipts (must point at a host serving the (public) route group).
export const PUBLIC_WEB_URL = 'https://smart-duka.vercel.app';

// Base URL of the deployed web export that serves the Help & Learning
// Center (app/help/*.web.tsx — web-only, excluded from native builds).
// Native screens link out to this instead of bundling the help UI.
export const HELP_CENTER_URL = 'https://smart-duka--s8k261aip8.expo.app';

// Matches app.json's "scheme" — used to deep-link from the web verification
// page into the native app when it's installed (falls back to the web page
// itself, which is already loaded, if it isn't).
export const APP_SCHEME = 'smartduka';

export const APP_NAME = 'Smart Duka';
export const APP_VERSION = '1.0.0';

export const PAYMENT_METHODS = [
  { label: 'Cash', value: 'cash' },
  { label: 'M-Pesa', value: 'mpesa' },
] as const;

export const DEFAULT_LOW_STOCK_ALERT = 5;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
