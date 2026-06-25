# Smart Duka — Full App Documentation

Smart Duka is a mobile-first Point-of-Sale (POS) system for Kenyan small businesses. It runs on Android and iOS via Expo, with a companion web export for receipt verification. The backend is a Node.js/Express REST API deployed on Vercel with MongoDB Atlas.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Environment Setup](#environment-setup)
4. [Authentication](#authentication)
5. [Owner Features](#owner-features)
   - [Dashboard](#owner-dashboard)
   - [Inventory](#inventory)
   - [Sales](#owner-sales)
   - [Staff Management](#staff-management)
   - [Reports](#reports)
   - [Expenses](#expenses)
   - [Payments (M-Pesa)](#payments--mpesa-integration)
   - [Profile & Shop Settings](#profile--shop-settings)
6. [Staff Features](#staff-features)
   - [Dashboard](#staff-dashboard)
   - [Inventory](#staff-inventory)
   - [Sales](#staff-sales)
   - [Expenses](#staff-expenses)
7. [Receipt Verification & Ratings](#receipt-verification--ratings)
8. [Push Notifications](#push-notifications)
9. [Help Center](#help-center)
10. [Backend API Reference](#backend-api-reference)
11. [Permissions System](#permissions-system)
12. [Design System](#design-system)

---

## Tech Stack

### Frontend (Mobile App)

| Layer | Technology |
|---|---|
| Framework | Expo SDK (React Native) |
| Navigation | Expo Router (file-based, tab + stack) |
| State management | Zustand (auth store) |
| Server state | TanStack Query v5 |
| Animations | React Native Reanimated v4 |
| UI gradients | expo-linear-gradient |
| Icons | @expo/vector-icons (Ionicons) |
| Push notifications | @react-native-firebase/messaging (FCM) |
| Receipt printing | expo-print + expo-sharing |
| Image upload | expo-image-picker + Cloudinary |

### Backend (API)

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (ES modules) |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Email | Nodemailer (Gmail SMTP) |
| Validation | Joi |
| File uploads | Cloudinary |
| Push notifications | Firebase Admin SDK |
| SMS | Africa's Talking REST API |
| Credential encryption | Node.js built-in `crypto` (AES-256-GCM) |
| Scheduled jobs | Vercel Cron |
| Logging | Morgan |
| Rate limiting | express-rate-limit |

---

## Project Structure

```
smart-duka/                     # Frontend (Expo)
├── app/
│   ├── (auth)/                 # Login, register, forgot password, verify email, onboarding
│   ├── (owner)/                # Owner tab group
│   │   ├── dashboard.tsx
│   │   ├── inventory/          # Inventory list, new product, edit product
│   │   ├── sales.tsx
│   │   ├── staff/              # Staff list, new, view, edit, permissions
│   │   ├── reports.tsx
│   │   ├── expenses.tsx
│   │   ├── payments.tsx        # M-Pesa transactions (hidden from tab bar)
│   │   └── profile.tsx
│   ├── (staff)/                # Staff tab group
│   │   ├── dashboard.tsx
│   │   ├── inventory.tsx
│   │   ├── sales.tsx
│   │   ├── expenses.tsx
│   │   └── profile.tsx
│   ├── (public)/
│   │   └── r/[token].tsx       # Receipt verification + rating (unauthenticated, web)
│   └── help/                   # Help center (web-only)
├── components/
│   ├── auth/
│   ├── dashboard/              # StatsRow, SalesSummaryCard, LowStockList, RecentTransactions
│   ├── expenses/               # ExpensesScreen, ExpenseFormSheet
│   ├── inventory/              # ProductCard, ProductForm, InventoryHeader, InventoryStatsRow, StockUpdateModal
│   ├── payments/               # PaymentsSection, MpesaConfigForm, VerificationModal, MpesaPaymentModal
│   ├── profile/                # AccountInfo, ShopSettingsForm, ChangePasswordForm
│   ├── reports/                # HeroRevenueCard, PeriodSegmentControl, ReportSections, TrendChart
│   ├── sales/                  # CartItem, CartSummary, QuantityModal, SaleCard, SaleDetailsModal,
│   │                           #   SalesList, SalesFilters, ReceiptModal, ReceiptPreview, VariantPickerModal
│   ├── staff/                  # StaffCard, ResetPasswordModal
│   └── ui/                     # Button, Input, Card, BottomSheet, SearchBar, Screen,
│                               #   EmptyState, ErrorState, LoadingState, DatePicker, ListRow, …
├── services/                   # API clients: auth, dashboard, products, sales, shop,
│                               #   staff, ratings, analytics, notifications, reports,
│                               #   expenses, mpesa, otp, paymentConfig
├── store/                      # authStore (Zustand)
├── constants/                  # Colors, Typography, Spacing, Shadows, BorderRadius, Motion, config
├── utils/                      # receiptHtml, formatters, …
└── hooks/                      # useOfflineStatus, …

smart-duka-backend/             # Backend (Express)
├── src/
│   ├── models/                 # User, Shop, Product, Sale, Staff, Rating, OTP,
│   │                           #   EmailVerificationToken, NotificationLog, Expense,
│   │                           #   PaymentConfig, MpesaTransaction, PaymentVerificationSession, AuditLog
│   ├── controllers/
│   ├── services/               # pricingEngine, mpesaService, encryptionService,
│   │                           #   africasTalkingService, otpService, auditLogService
│   ├── validations/            # Joi schemas for all endpoints
│   ├── middlewares/            # auth (protect, ownerOnly, staffOrOwner),
│   │                           #   validate, requireVerificationToken, rateLimiter
│   └── routes/v1/              # authRoutes, productRoutes, saleRoutes, staffRoutes,
│                               #   dashboardRoutes, shopRoutes, ratingRoutes, analyticsRoutes,
│                               #   reportRoutes, expenseRoutes, cronRoutes, publicRoutes,
│                               #   paymentConfigRoutes, otpRoutes, mpesaRoutes
└── scripts/
    └── migrate-product-types.js
```

---

## Environment Setup

### Frontend — `constants/config.ts`

```ts
API_BASE_URL  = 'https://smart-duka-backend-iota.vercel.app/api/v1'
PUBLIC_WEB_URL = 'https://smart-duka.vercel.app'   // receipt QR base URL
HELP_CENTER_URL = 'https://smart-duka--01nm282g2e.expo.app/'
APP_SCHEME    = 'smartduka'                        // deep-link scheme
```

### Backend — `.env`

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 5000) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Signing secret for user JWTs |
| `JWT_EXPIRES_IN` | JWT lifetime (e.g. `7d`) |
| `BCRYPT_ROUNDS` | bcrypt salt rounds |
| `SMTP_HOST/PORT/USER/PASS` | Gmail SMTP for OTP & verification emails |
| `SMTP_FROM` | Sender name + address |
| `RECEIPT_TOKEN_SECRET` | HMAC secret for receipt QR tokens |
| `CRON_SECRET` | Bearer secret for Vercel Cron endpoints |
| `PUBLIC_WEB_URL` | Base URL for receipt QR links |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | Profile photo & product image storage |
| `ENCRYPTION_KEY` | 32+ char secret for AES-256-GCM credential encryption — **never change after first use** |
| `AT_USERNAME` | Africa's Talking username (`sandbox` for testing) |
| `AT_API_KEY` | Africa's Talking API key |
| `MPESA_CALLBACK_URL` | Public HTTPS URL Safaricom POSTs STK Push results to |

---

## Authentication

Route group: `app/(auth)/`

### Screens

| Screen | Description |
|---|---|
| **Onboarding** | First-launch welcome with app overview |
| **Login** | Email + password; JWT stored in Zustand + AsyncStorage |
| **Register** | Owner registration — name, email, password, shop name, optional address & phone; sends 6-digit email verification code |
| **Verify Email** | Enter 6-digit code to activate account; resend option |
| **Forgot Password** | Email → 6-digit OTP → new password flow |

### How it works

- Owners register and verify their email before logging in.
- Staff accounts are created by the owner (no self-registration).
- JWT is returned on login and attached to all subsequent API requests as `Authorization: Bearer <token>`.
- Role (`owner` | `staff`) is embedded in the JWT; the backend enforces role and permission checks on every protected endpoint.
- On app launch, Zustand hydrates from AsyncStorage and restores the session.

---

## Owner Features

### Owner Dashboard

**Screen:** `app/(owner)/dashboard.tsx`

Real-time summary of today's business performance:

- **Stats row** — Today's revenue (cash + M-Pesa split), transaction count, total products, current stock value
- **Sales summary card** — Cash vs M-Pesa revenue breakdown with visual bar
- **Low stock list** — Products below their `lowStockAlert` threshold, with a tap-to-view link to the product
- **Recent transactions** — Last 10 sales with amount, payment method, staff name, and timestamp
- Pull-to-refresh; all data fetched via `GET /dashboard/owner`

---

### Inventory

**Routes:** `app/(owner)/inventory/`

Full product lifecycle management.

#### Product Types

| Type | Description |
|---|---|
| `standard` | Fixed price, integer quantity (default) |
| `variable` | Staff can override unit price at checkout; optional min/max price bounds |
| `weighted` / `refillable` | Price per unit of measure (kg, g, L, mL); decimal quantities allowed |
| `service` | No mandatory stock check (toggleable); optional price override |
| `bundle` | Flat combo price; deducts stock from each component product |
| `configurable` | Named variants (e.g. sizes, colours) each with own price, stock, and SKU |

#### Screens & Features

- **Inventory list** — Paginated product list with search, category filter, and fast/slow-mover filter; `InventoryStatsRow` shows total products, stock value, and low-stock count
- **Predicted stockout banner** — Products with < 3 days of stock (based on actual sales velocity) surface a warning chip
- **New product** (`inventory/new.tsx`) — Full `ProductForm` supporting all six product types; image upload via Cloudinary
- **Edit product** (`inventory/[id]/edit.tsx`) — Same form pre-populated; stock quantity editable inline
- **Stock update modal** — Quick stock adjustment without opening the full edit form
- **ProductCard** — Shows price, quantity, low-stock badge, product type chip

---

### Owner Sales

**Screen:** `app/(owner)/sales.tsx`

Historical sales ledger for the whole shop.

- Stats cards at the top: total revenue, cash, M-Pesa (M-Pesa card is tappable → navigates to M-Pesa Transactions screen)
- Date-range filter, payment method filter, staff filter
- Paginated `SalesList` with `SaleCard` rows
- Tap any sale → `SaleDetailsModal` with full line-item breakdown
- Receipt re-print from the detail modal (HTML receipt via `expo-print`)

---

### Staff Management

**Routes:** `app/(owner)/staff/`

Full CRUD for staff accounts.

| Screen | Description |
|---|---|
| **Staff list** (`staff/index.tsx`) | All staff with search, active/inactive status badge, `StaffCard` rows |
| **New staff** (`staff/new.tsx`) | Create account with name, email, password, phone |
| **View staff** (`staff/[id]/index.tsx`) | Profile, contact info, sales summary, active status toggle |
| **Edit staff** (`staff/[id]/edit.tsx`) | Update name, email, phone, active status |
| **Permissions** (`staff/permissions.tsx`) | Granular permission toggles per staff member; see [Permissions System](#permissions-system) |

Additional actions:
- **Reset staff password** — Owner sets a new password directly from the staff detail screen
- **View staff sales** — Sales history filtered to a specific staff member

---

### Reports

**Screen:** `app/(owner)/reports.tsx`

Business intelligence for a selectable time period (Today / Week / Month / Year).

| Section | Data shown |
|---|---|
| **Hero Revenue Card** | Total revenue for period with period-over-period change indicator |
| **Period Segment Control** | Tab selector (Today / Week / Month / Year) |
| **Insight Cards** | Transaction count, average basket value, busiest hour |
| **Trend Chart** | Revenue over time (bar/line) |
| **Top Products Leaderboard** | Highest-revenue products for the period |
| **Staff Performance** | Revenue and transaction count per staff member |
| **Ratings Module** | Average star rating, distribution, top/bottom staff by rating |
| **Stock Intelligence** | Fast-movers, slow-movers, predicted stockout dates |
| **Quick Shortcuts** | Jump to Inventory, Staff, or Expenses |

Data sources:
- `GET /reports/sales?period=...` — revenue, transactions, trends
- `GET /ratings/summary` — ratings aggregation
- `GET /analytics/depletion?windowDays=30` — velocity-based stockout prediction

---

### Expenses

**Screen:** `app/(owner)/expenses.tsx` and `app/(staff)/expenses.tsx`

Track business running costs.

- **Categories:** rent, utilities, supplies, transport, salaries, marketing, other
- **Expense list** with date, category, amount, description, recorded-by
- **Summary card** — total expenses for the period, category breakdown
- **Add expense** via `ExpenseFormSheet` bottom sheet
- **Edit / delete** existing expenses
- Staff with `manage_expenses` permission can also add/edit expenses

---

### Payments — M-Pesa Integration

**Screens:** M-Pesa config lives inside Profile → Shop Settings → Payments section; transactions at `app/(owner)/payments.tsx`

#### Overview

Each Smart Duka business connects their own **Lipa Na M-Pesa Business** account. Customers pay via STK Push (prompt on their phone) directly from the staff checkout screen. No shared Safaricom credentials — every shop owns their keys.

#### Payments Section (Shop Settings)

Located inside the collapsible "Payments" section in the owner's Profile screen.

**Identity verification gate:**
Before any sensitive payment action (viewing config, saving credentials, disconnecting), the owner must complete identity verification:
1. Choose delivery method: **SMS** (Africa's Talking) or **Email** (SMTP)
2. Enter the 6-digit OTP delivered to their registered phone/email
3. A 10-minute verification session token is issued (JWT, in-memory only — never AsyncStorage)
4. All subsequent config API calls include this token as `X-Verification-Token` header

OTP security:
- bcrypt-hashed in MongoDB
- 5 max attempts; session locked after failure
- 60-second resend timer
- Rate-limited: 3 OTP requests / 10 min, 10 verifications / 10 min
- Session TTL enforced by MongoDB TTL index

**M-Pesa configuration form:**
| Field | Notes |
|---|---|
| Business Name | Displayed on receipts |
| Shortcode | 5–7 digit M-Pesa Business shortcode |
| Consumer Key | AES-256-GCM encrypted at rest |
| Consumer Secret | AES-256-GCM encrypted at rest |
| Passkey | AES-256-GCM encrypted at rest |
| Environment | Sandbox (testing) or Production toggle |

Once saved, sensitive fields **never appear in plaintext** — shown as `••••••••••••••••` with a green "Set" badge. Edit replaces all values atomically.

**Encryption details:**
- Algorithm: AES-256-GCM
- Key derived via `scryptSync(ENCRYPTION_KEY, SALT, 32)` — Node.js built-in `crypto`, no extra packages
- Stored format: `base64(iv):base64(authTag):base64(ciphertext)` per field
- Decryption happens server-side only, during live Safaricom API calls

#### STK Push at Checkout (Staff Sales)

When M-Pesa is enabled for the shop, staff see an M-Pesa option in the payment method selector at checkout.

**Checkout flow:**
1. Staff selects M-Pesa, enters customer's Kenyan phone number (any format: `07XX`, `+2547XX`, `2547XX`)
2. Tap **Send Payment Request** → `MpesaPaymentModal` opens (no screen navigation)
3. App calls `POST /mpesa/initiate` → backend contacts Safaricom STK Push API
4. Customer receives a prompt on their phone to enter their M-Pesa PIN
5. **Pending state** — animated pulsing dots shown; frontend polls `GET /mpesa/status/:id` every 3 seconds for up to 90 seconds
6. Safaricom sends callback to `POST /mpesa/callback` (public endpoint, no auth)
7. On success → sale is automatically created with the confirmed `mpesaTransactionId`
8. Receipt includes a green M-Pesa confirmation block with the M-Pesa receipt number

**Terminal states:**

| State | Description |
|---|---|
| `success` | Payment confirmed; sale created; receipt shown |
| `failed` | Customer declined or wrong PIN; retry option |
| `cancelled` | Customer cancelled prompt |
| `timeout` | No response within 90s; retry option |

**Backend idempotency:** Callback endpoint checks `transaction.status !== 'pending'` before processing — safe against Safaricom retries.

#### M-Pesa Transactions Screen

**Screen:** `app/(owner)/payments.tsx` — accessible by tapping the M-Pesa stat card in owner Sales

- **Hero card** — Total M-Pesa volume, success rate %, success / pending / failed / cancelled counts
- **Status filter chips** — All / Success / Pending / Failed / Cancelled
- **Search** — by phone number or M-Pesa receipt number
- **Infinite scroll list** via TanStack Query `useInfiniteQuery`
- **Transaction detail bottom sheet** — full details including checkout request ID, merchant request ID, phone, amount, status, linked sale, M-Pesa receipt number, timestamps
- **Audit trail** — Every STK Push initiation, callback, config change, and OTP event is logged to `AuditLog` (immutable, write-only)

---

### Profile & Shop Settings

**Screen:** `app/(owner)/profile.tsx`

Collapsible sections:

| Section | Contents |
|---|---|
| **Account Info** | Name, email, phone; profile photo upload (Cloudinary) |
| **Change Password** | Current password + new password with confirmation |
| **Shop Settings** | Shop name, address, phone, email, tax rate, currency, receipt branding, logo |
| **Receipt Branding** | Custom footer message, shop logo shown on receipts |
| **Payments** | M-Pesa Business configuration (see above) |
| **Notifications** | Toggle push notification alerts (daily sales anomaly, low stock) |
| **Help & Support** | Links to Help Center web app |
| **Sign Out** | Clears auth state and navigates to login |

---

## Staff Features

### Staff Dashboard

**Screen:** `app/(staff)/dashboard.tsx`

Scoped to the current staff member's own activity:

- Today's personal sales total (cash + M-Pesa)
- Transaction count for today
- Recent personal sales list
- Data from `GET /dashboard/staff`

---

### Staff Inventory

**Screen:** `app/(staff)/inventory.tsx`

- Browse the shop's full product catalogue
- Search and category filter
- Product cards (staff cannot see `costPrice`)
- Staff with `create_product`, `edit_product`, `edit_product_stock`, or `delete_product` permissions see the corresponding action buttons

---

### Staff Sales

**Screen:** `app/(staff)/sales.tsx`

Point-of-sale interface:

**Cart flow:**
1. Search or browse products
2. Tap to add to cart; long-press or tap qty chip to set quantity
3. `QuantityModal` for quantity entry
4. `VariantPickerModal` for `configurable` products — select a named variant before adding
5. `CartSummary` shows line items, subtotal, tax, and total

**Checkout:**
- Select payment method: **Cash** or **M-Pesa**
- Cash → direct `POST /sales` → receipt displayed
- M-Pesa → enter customer phone → STK Push flow (see [Payments](#payments--mpesa-integration))
- `ReceiptModal` shows receipt preview after confirmed payment
- Receipt can be printed (HTML via `expo-print`) or shared

**Sales history:**
- `SalesList` filtered to the staff member's own sales (or all sales if `view_all_sales` permission is granted)
- Date range filter, payment method filter
- `SaleDetailsModal` with full breakdown

**Special product type handling:**

| Type | Checkout behavior |
|---|---|
| `variable` | Staff can override the unit price (clamped to min/max if set) |
| `weighted` / `refillable` | Quantity input accepts decimals (e.g. 1.5 kg) |
| `service` | No stock deduction if `trackInventory: false` |
| `bundle` | Single line item; backend deducts each component's stock |
| `configurable` | `VariantPickerModal` required before adding to cart |

---

### Staff Expenses

**Screen:** `app/(staff)/expenses.tsx`

Same UI as the owner expenses screen, but create/edit/delete actions are gated behind the `manage_expenses` permission.

---

## Receipt Verification & Ratings

**Route:** `app/(public)/r/[token].tsx` (web-only, unauthenticated)

Every completed sale produces a signed **receipt token** (HMAC/JWT, never stored in the database). This token is embedded as a QR code on the printed/shared receipt.

When a customer scans the QR code:
1. They land on the public web page at `PUBLIC_WEB_URL/r/<token>`
2. The app calls `GET /public/receipt/:token` to verify authenticity and fetch receipt summary
3. If not yet rated, a star rating form (1–5 stars + optional comment) is shown
4. Rating submitted via `POST /public/receipt/:token/rating`
5. One rating per sale — re-submission returns the existing rating

Receipt HTML (generated by `utils/receiptHtml.ts`):
- Shop name, logo, address
- Invoice number, date/time, staff name
- Line items with quantity, unit price, subtotal
- Tax line (if configured)
- Total amount and payment method
- M-Pesa confirmation block (green, with M-Pesa receipt number) — only on M-Pesa sales
- QR code for verification
- Custom footer message

Ratings aggregate into the owner's Reports → Ratings Module and the owner Dashboard `ratingSummary`.

---

## Push Notifications

Uses **Firebase Cloud Messaging** (FCM) via `@react-native-firebase/messaging` (native module).

**Requires a native build** — does not work in Expo Go. `services/notifications.ts` dynamically imports the native module and no-ops gracefully in Expo Go or on web.

**Setup:**
1. Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) from Firebase Console to the project root
2. Run `npx expo prebuild` or trigger a new EAS build

**Notification types (owner only):**

| Alert | Trigger |
|---|---|
| **Daily sales anomaly** | Today's sales are significantly above or below the 14-day trailing average (|z-score| > 1.5) |
| **Low stock / stockout prediction** | A product is projected to run out within 3 days based on actual sales velocity |

**Scheduling:** Both run as Vercel Cron jobs (`GET /cron/daily-sales-check`, `GET /cron/depletion-alerts`). Each job is idempotent per `(shop, day)` via the `NotificationLog` collection — safe on retry.

**Toggle:** Owners can enable/disable push alerts from Profile → Notifications.

---

## Help Center

**Routes:** `app/help/` (web-only — `.web.tsx` variants)

Native builds link out to `HELP_CENTER_URL` via `Linking.openURL`. The web export serves the Help Center pages directly. Uses `[slug].tsx` for dynamic article routing.

---

## Backend API Reference

**Base URL:** `https://smart-duka-backend-iota.vercel.app/api/v1`

All protected endpoints require: `Authorization: Bearer <jwt_token>`

### Auth — `/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register new owner + shop |
| POST | `/auth/login` | Public | Login (returns JWT) |
| POST | `/auth/verify-email` | Public | Confirm 6-digit email code |
| POST | `/auth/resend-verification` | Bearer | Resend verification code (authenticated) |
| POST | `/auth/resend-verification-email` | Public | Resend code for unverified user |
| POST | `/auth/forgot-password` | Public | Send password-reset OTP to email |
| POST | `/auth/verify-otp` | Public | Verify password-reset OTP |
| POST | `/auth/reset-password` | Public | Set new password after OTP verified |
| GET | `/auth/profile` | Bearer | Get current user profile |
| PUT | `/auth/profile` | Bearer | Update name, email, phone |
| POST | `/auth/change-password` | Bearer | Change password (requires current password) |
| POST | `/auth/device-token` | Bearer | Register FCM device token |
| DELETE | `/auth/device-token` | Bearer | Unregister FCM device token |

### Products — `/products`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/products` | Bearer | List products (search, category, page, limit) |
| GET | `/products/:id` | Bearer | Get single product |
| POST | `/products` | Owner / create_product | Create product (all types) |
| PUT | `/products/:id` | Owner / edit_product | Update product |
| DELETE | `/products/:id` | Owner / delete_product | Delete product |
| PATCH | `/products/:id/stock` | Owner / edit_product_stock | Update stock quantity |

### Sales — `/sales`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/sales` | Bearer | Record a sale (atomic, stock deduction) |
| GET | `/sales` | Bearer | List sales (date range, staff, payment method, page) |
| GET | `/sales/me` | Bearer | Personal sales (staff) |
| GET | `/sales/:id` | Bearer | Get sale by ID (includes receiptToken) |

### Staff — `/staff` (Owner only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/staff` | List all staff (search) |
| GET | `/staff/:id` | Get staff member |
| POST | `/staff` | Create staff account |
| PUT | `/staff/:id` | Update staff |
| POST | `/staff/:id/reset-password` | Reset staff password |
| DELETE | `/staff/:id` | Delete staff |
| GET | `/staff/:id/sales` | Sales by this staff member |
| PUT | `/staff/:id/permissions` | Update permissions |
| GET | `/staff/permissions` | List all available permissions |

### Dashboard — `/dashboard`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/dashboard/owner` | Owner | Today's stats, low stock, recent transactions, ratings |
| GET | `/dashboard/staff` | Staff | Personal today's stats and recent sales |

### Shop — `/shop`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/shop` | Bearer | Get shop settings |
| PUT | `/shop` | Owner | Update shop settings |

### Ratings — `/ratings` (Owner only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/ratings` | List ratings (staffId, stars, page) |
| GET | `/ratings/summary` | Aggregated: avg, distribution, by staff |

### Analytics — `/analytics` (Owner only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/analytics/depletion?windowDays=30` | Sales velocity, stockout dates, fast/slow movers |

### Reports — `/reports` (Owner only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/reports/sales?period=week` | Revenue, transactions, trends for a period |

### Expenses — `/expenses`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/expenses` | Staff or Owner | List expenses (date, category, page) |
| GET | `/expenses/summary` | Staff or Owner | Category totals for a period |
| POST | `/expenses` | Owner / manage_expenses | Create expense |
| PUT | `/expenses/:id` | Owner / manage_expenses | Update expense |
| DELETE | `/expenses/:id` | Owner / manage_expenses | Delete expense |

### Payment Config — `/payment-config`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/payment-config/status` | Staff or Owner | Safe check — is M-Pesa connected? (no credentials) |
| GET | `/payment-config` | Owner + Verification Token | Get masked config (shows `consumerKeySet`, never plaintext) |
| PUT | `/payment-config/mpesa` | Owner + Verification Token | Save/update M-Pesa config |
| DELETE | `/payment-config/mpesa` | Owner + Verification Token | Disconnect M-Pesa |

### OTP (Payment Verification) — `/otp`

Rate-limited: 3 requests / 10 min; 10 verifications / 10 min.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/otp/request` | Owner | Request OTP (method: sms \| email) |
| POST | `/otp/verify` | Owner | Verify OTP; returns verification JWT on success |

### M-Pesa — `/mpesa`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/mpesa/callback` | **Public** | Safaricom STK Push result webhook |
| POST | `/mpesa/initiate` | Staff or Owner | Initiate STK Push (returns transactionId) |
| GET | `/mpesa/status/:transactionId` | Staff or Owner | Poll transaction status |
| GET | `/mpesa/transactions` | Owner | List M-Pesa transactions (search, status, page) |
| GET | `/mpesa/transactions/:id` | Owner | Get single M-Pesa transaction |

### Public — `/public`

Rate-limited: 30 requests / 15 min / IP.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/public/receipt/:token` | Public | Verify receipt, check if already rated |
| POST | `/public/receipt/:token/rating` | Public | Submit 1–5 star rating + comment |

### Cron — `/cron` (Vercel Cron only)

Gated by `Authorization: Bearer <CRON_SECRET>`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/cron/daily-sales-check` | z-score anomaly check vs 14-day average; push alert to owner if |z| > 1.5 |
| GET | `/cron/depletion-alerts` | Push alert for products projected to run out within 3 days |

---

## Permissions System

Default staff permissions (assigned on creation):
```
view_products, record_sale, view_sales
```

Full permission list:

| Permission | Area | Description |
|---|---|---|
| `view_products` | Inventory | View product list and details |
| `create_product` | Inventory | Create new products |
| `edit_product` | Inventory | Edit product details |
| `delete_product` | Inventory | Delete products |
| `edit_product_stock` | Inventory | Update stock quantity |
| `view_sales` | Sales | View own sales |
| `record_sale` | Sales | Create a sale |
| `view_all_sales` | Sales | View all shop sales (not just own) |
| `manage_expenses` | Expenses | Create, edit, delete expenses |
| `manage_staff` | Staff | Reserved — owner only |
| `edit_shop_settings` | Settings | Reserved — owner only |

Owners bypass all permission checks and have access to everything.

---

## Design System

Defined in `constants/`:

### Colors

| Token | Value | Use |
|---|---|---|
| `primary` | `#0F766E` | Brand teal, CTAs, active states |
| `primaryLight` | `#14B8A6` | Hover, icon accents |
| `accent` | `#C8932A` | Gold highlights |
| `success` | `#15803D` | Positive states, M-Pesa confirmed |
| `warning` | `#F59E0B` | Low stock, pending states |
| `danger` | `#DC2626` | Errors, destructive actions |
| `background` | `#F8FAFC` | Screen background |
| `surface` | `#FFFFFF` | Card backgrounds |
| `textPrimary` | `#0F172A` | Headings |
| `textSecondary` | `#64748B` | Subtitles, labels |
| `textTertiary` | `#94A3B8` | Placeholders, timestamps |

### Typography

- Font family: system default sans-serif with bold/semibold/medium variants
- Sizes: `xs` (10) → `small` (13) → `base` (15) → `large` (18) → `xl` (22) → `2xl` (28) → `3xl` (34)

### Spacing

Geometric scale: `xs` (4) → `sm` (8) → `md` (12) → `lg` (16) → `xl` (24) → `2xl` (32) → `3xl` (48)

### Animations

All animations use React Native Reanimated v4:
- `FadeInDown` / `FadeIn` for screen entries
- Spring animations for modals and bottom sheets
- Pulse animation for M-Pesa pending state (WaitingDots component)
- Shake animation for wrong OTP entry
- `AnimatedPressable` component wraps tappable elements with subtle scale feedback

---

## Data Flow — M-Pesa Sale (End-to-End)

```
Staff taps "Send Payment Request"
        │
        ▼
POST /mpesa/initiate
  └─ Backend fetches OAuth token from Safaricom
  └─ POST to Safaricom STK Push API with customer phone + amount
  └─ Returns { transactionId } to frontend
        │
        ▼
MpesaPaymentModal polls GET /mpesa/status/:transactionId every 3s
        │
(Safaricom sends callback)
        ▼
POST /mpesa/callback (public endpoint, no auth)
  └─ parseSTKCallback validates payload
  └─ Updates MpesaTransaction.status (success/failed/cancelled)
  └─ Idempotency guard: skip if status !== 'pending'
  └─ logAudit('mpesa.callback.received')
        │
        ▼
Frontend poll returns status=success
        │
        ▼
POST /sales { items, paymentMethod: 'mpesa', mpesaTransactionId }
  └─ Validates MpesaTransaction.status === 'success'
  └─ Validates transaction not already linked to another sale
  └─ Creates Sale (MongoDB transaction — atomic stock deduction)
  └─ Links MpesaTransaction.saleId = sale._id
  └─ Returns { receiptToken, invoiceNumber, mpesaReceiptNumber }
        │
        ▼
ReceiptModal — HTML receipt with green M-Pesa confirmation block
```

---

## Deployment Notes

- **Frontend:** EAS Build for Android (`.apk` / `.aab`) and iOS. Requires `google-services.json` + `GoogleService-Info.plist` for FCM push notifications.
- **Backend:** Deployed to Vercel (`vercel.json` configures serverless functions + cron schedule). Set all env vars in Vercel project settings.
- **One-time migration:** After first deploy with flexible product types, run `node scripts/migrate-product-types.js` against the production database to backfill `productType: 'standard'` on legacy products.
- **M-Pesa callback:** `MPESA_CALLBACK_URL` must be a publicly reachable HTTPS URL. Use ngrok for local development testing.
- **Encryption key:** `ENCRYPTION_KEY` must never change after M-Pesa credentials are stored — changing it will corrupt all stored configurations. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
