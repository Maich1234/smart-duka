# Smart Duka 👋

Smart Duka is a mobile app for managing a shop's inventory, sales, and staff. It's built with [Expo](https://expo.dev) and [Expo Router](https://docs.expo.dev/router/introduction), and supports separate experiences for shop owners and staff.

## Features

- **Auth** — login, registration, email verification, and password recovery
- **Owner dashboard** — inventory, sales, staff management, and profile
- **Staff dashboard** — inventory and sales, scoped to staff permissions
- **Payments** — cash and M-Pesa
- **Flexible product types** — standard, variable-price, weighted/refillable (per kg/L), service, bundle, and configurable (variant) products, with a checkout flow tailored to each
- **QR receipts & ratings** — every receipt carries a QR code customers scan to verify authenticity and rate their service; ratings roll up into Reports
- **Inventory depletion analytics** — fast/slow-mover filters and predicted-stockout banners in Inventory, a Stock Velocity card in Reports, based on actual sales velocity rather than a static threshold
- **Push notifications** — owners get alerted (via Firebase Cloud Messaging) when daily sales are significantly above/below normal, or when products are predicted to run out soon; toggle in Profile
- **Low stock alerts** and paginated product/sales lists

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Project structure

- `app/` — routes, grouped into `(auth)`, `(owner)`, `(staff)`, and `(public)` segments
  - `(public)/r/[token].tsx` — unauthenticated receipt-verification + rating page, reached by scanning a receipt's QR code (no login required, works on web)
- `components/` — shared UI components
  - `components/sales/VariantPickerModal.tsx` — variant selector for `configurable` products at checkout
- `services/` — API clients (`auth`, `dashboard`, `products`, `sales`, `shop`, `staff`, `ratings`, `analytics`, `notifications`)
- `store/` — Zustand stores (e.g. `authStore`)
- `constants/` — app config, theme tokens (colors, spacing, typography, shadows)
- `context/`, `hooks/`, `utils/` — supporting app logic

The API base URL, `PUBLIC_WEB_URL` (used to build receipt QR codes), and other app-wide settings live in [constants/config.ts](constants/config.ts).

### Firebase Admin SDK (server-side only)

The Firebase Admin SDK service account key must **never** be placed in this mobile project. It grants full admin-level Firebase access and must only live in backend environment variables (e.g. Vercel).

If a service account key is accidentally committed or exposed, rotate it immediately:
**Firebase Console → Project Settings → Service Accounts → Generate new private key**

### Push notifications (FCM) setup

Push uses the native `@react-native-firebase/messaging` client (the backend sends pushes via the Firebase Admin SDK — see the backend README), which requires a rebuilt native app — it will **not** work in Expo Go or a stale dev-client build:

1. Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) from the Firebase Console to the project root — `app.json` already references them via `android.googleServicesFile`/`ios.googleServicesFile`.
2. Run `npx expo prebuild` (or trigger a new EAS build) so the native Firebase config plugins take effect.
3. The rest of the app — including the web export — works fine without these files; `services/notifications.ts` dynamically imports the native module and no-ops if it isn't available (e.g. on web or in Expo Go), so nothing else breaks while you set this up.

## Learn more

To learn more about developing with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.
