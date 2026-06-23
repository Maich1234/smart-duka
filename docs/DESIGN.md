# Smart Duka — Design Reference

A reference for designers working on Smart Duka, a mobile app (Expo / React Native) for shop owners and staff to manage inventory, sales, expenses, and staff. This document describes the current implemented UI: design tokens, components, screens, and key flows — so designs stay consistent with what's already built and easy for engineering to implement.

---

## 1. App overview

Smart Duka has two parallel experiences sharing the same visual language but different navigation and permissions:

- **Owner** — full access: dashboard, inventory, sales, staff management, reports, expenses, profile/shop settings.
- **Staff** — scoped subset: dashboard, inventory, sales, expenses, profile. No staff management or reports tab.

A third, unauthenticated surface exists for customers: a **receipt verification + rating page**, reached by scanning a QR code printed on receipts. It works on web, requires no login.

---

## 2. Navigation structure

```
app/
├─ splash                     animated splash → routes based on auth state
├─ (auth)                     stack, modal presentation for sub-flows
│  ├─ login                   no header
│  ├─ register                modal
│  ├─ forgot-password         modal
│  ├─ verify-email            no back button, no swipe-back
│  └─ onboarding              no header, no swipe-back
├─ (owner)                    bottom tabs
│  ├─ dashboard  "Home"       tab
│  ├─ inventory  "Stock"      tab (+ index/new/[id]/edit sub-routes)
│  ├─ sales      "Sales"      tab
│  ├─ staff      "Staff"      tab (own header, hidden tab-bar header)
│  ├─ reports                 hidden from tab bar, reached via navigation
│  ├─ expenses                hidden from tab bar, reached via navigation
│  └─ profile                 tab
├─ (staff)                    bottom tabs
│  ├─ dashboard  "Home"       tab
│  ├─ inventory  "Stock"      tab
│  ├─ sales      "Sales"      tab
│  ├─ profile                 tab
│  └─ expenses                hidden from tab bar
├─ (public)/r/[token]         receipt verification + rating, no auth, web-friendly
└─ (help)                     in-app help articles, index + [slug]
```

**Tab bar**: 5 icons max per role (Ionicons: `home`, `cube`, `cash`/`cart`, `people`, `person`). iOS uses a translucent `BlurView` floating bar; Android uses a solid surface-colored bar with a top border. Active tint = `Colors.primary`, inactive = `Colors.textSecondary`.

**Headers**: shown by default, surface-colored background, no shadow, semibold title. Auth sub-flows (register, forgot-password) present as modals; verify-email and onboarding lock back-navigation.

Root redirect logic (`app/index.tsx`): logged-in users skip the splash and land directly on their role's dashboard; logged-out users see the animated splash first.

---

## 3. Design tokens

All tokens live in `constants/` — designers should treat these as the source of truth (Figma styles should mirror these names 1:1).

### Color (`constants/Colors.ts`)

| Role | Hex | Notes |
|---|---|---|
| Primary | `#0F766E` (teal) | dark `#115E59`, light `#14B8A6`, pressed `#0C5C56`, subtle bg `#E6F4F2` |
| Accent | `#C8932A` (gold) | dark `#9C6F1E`, light `#E0AC4C`, subtle bg `#FBF1DD` |
| Success | `#15803D` | subtle bg `#E6F4EA` |
| Warning | `#F59E0B` | subtle bg `#FEF3C7` |
| Info | `#2563EB` | |
| Danger / Error | `#DC2626` | subtle bg `#FEE2E2` |
| Background | `#F8FAFC` | app canvas |
| Surface | `#FFFFFF` | cards, sheets, headers |
| Text primary | `#0F172A` | |
| Text secondary | `#64748B` | |
| Text tertiary | `#94A3B8` | |
| Text disabled | `#CBD5E1` | |
| Border | `#E2E8F0` | strong: `#CBD5E1` |
| Divider | `#F1F5F9` | |
| Overlay | `rgba(15,23,42,0.55)` | modal/sheet scrims |
| Pressed overlay | `rgba(15,23,42,0.06)` | |

The app currently ships **light theme only** in practice (a `useTheme` hook exists for future dark-mode support — see `hooks/useTheme.ts` — but `Colors.ts` constants are used directly throughout most screens).

### Typography (`constants/Typography.ts`)

- **Font family**: Inter — Regular 400, SemiBold 600 (`Inter_600SemiBold`), Bold 700 (`Inter_700Bold`). Loaded via `@expo-google-fonts/inter`.
- **Scale** (one numeric scale, two names for the same values):

| Token | Size (px) | Line height |
|---|---|---|
| display | 36 | 44 |
| h1 | 30 | 38 |
| h2 | 24 | 32 |
| h3 | 20 | 28 |
| body | 16 | 24 |
| small | 14 | 20 |
| caption | 12 | 16 |
| xxs | 10 | — |

- Letter spacing: tight `-0.3`, normal `0`, wide `0.2`.

### Spacing (`constants/Spacing.ts`)

`xs 4 · sm 8 · md 16 · lg 24 · xl 32 · xxl 48` — a single 8pt-ish scale used for padding, margin, and gaps everywhere.

### Border radius (`constants/BorderRadius.ts`)

`xs 4 · sm 8 · md 12 · lg 16 · xl 20 · full 999 · sheet 28` — `sheet` is reserved for the top corners of bottom sheets.

### Shadows (`constants/Shadows.ts`)

Three elevations (`sm`, `md`, `lg`), implemented as iOS shadow props / Android `elevation` via `Platform.select`. Cards default to `md`.

### Iconography

`@expo/vector-icons` → **Ionicons** exclusively (tab icons, input affordances, empty/error states reference Lottie animations instead of icons for larger illustrations).

---

## 4. Core UI components (`components/ui/`)

These are the only building blocks designs should be composed from — extending this set should be a deliberate decision, not a one-off.

| Component | Purpose | Key variants/props |
|---|---|---|
| `Screen` | Standard screen root: safe-area + keyboard avoidance + optional scroll | `scroll`, `padded` (default lg padding), `edges`, `backgroundColor` |
| `Button` | Primary action control | `variant`: primary / secondary / outline / ghost / danger · `size`: sm / md / lg · `loading`, `disabled`, haptic tap feedback |
| `Card` | Surface container | `elevation`: sm/md/lg · `padding`: spacing token · optional `onPress` (becomes tappable) |
| `Input` | Text field | `label`, `error` (red border + message), left/right Ionicon, built-in password show/hide toggle, focus state = 2px primary border |
| `BottomSheet` | Modal sheet anchored to bottom edge, rounded top corners (`radius.sheet`), drag handle, tap-outside-to-dismiss, keyboard-aware | used for all forms/confirmations/detail views instead of centered dialogs |
| `EmptyState` | "Nothing here yet" | Lottie animation (`empty-box.json`) + title + optional subtitle |
| `ErrorState` | Inline error/retry | — |
| `LoadingState` | Inline loading | — |
| `SearchBar` | List filtering | — |
| `DatePicker` | Date selection | platform-specific implementations (`.native`/`.web`) |
| `OfflineIndicator` | Global banner | appears below the status bar app-wide when network is unavailable; warning-colored, polls every 3s |

**Button color logic**: primary = solid teal / white text; secondary = divider-gray fill / dark text; outline = transparent fill / teal border + text; ghost = transparent / teal text; danger = solid red / white text. Disabled always overrides to gray fill + disabled-gray text regardless of variant.

---

## 5. Feature-specific components

- `components/dashboard/` — `MetricCard`, `StatsRow`, `SalesSummaryCard`, `LowStockList`, `RecentTransactions`
- `components/inventory/` — `ProductCard`, `ProductForm`, `InventoryHeader`, `StockUpdateModal`
- `components/sales/` — `CartItem`, `CartSummary`, `QuantityModal`, `VariantPickerModal` (for `configurable` products), `ReceiptModal`/`ReceiptPreview` (QR-coded receipt), `SaleCard`, `SaleDetailsModal`, `SalesFilters`, `SalesList`
- `components/staff/` — `StaffCard`, `ResetPasswordModal`
- `components/expenses/` — `ExpensesScreen`, `ExpenseFormSheet`
- `components/reports/` — `TrendChart`
- `components/profile/` — `AccountInfo`, `ChangePasswordForm`, `ShopSettingsForm`
- `components/auth/` — `AuthHeader`

---

## 6. Key UX flows worth knowing for design work

1. **Product types drive checkout UI.** Six product types — standard, variable-price, weighted/refillable (per kg/L), service, bundle, and configurable (variant) — each render a different checkout interaction (e.g. `VariantPickerModal` only appears for `configurable` products). Any inventory/sales redesign needs to account for all six.
2. **QR receipts.** Every completed sale generates a receipt with an embedded QR code (`qrcode` / `react-native-qrcode-svg`) linking to `(public)/r/[token]` — an unauthenticated, web-compatible page where the customer verifies the receipt and leaves a rating. Ratings feed back into the owner's Reports tab.
3. **Inventory analytics surfaces.** Fast/slow-mover filters and predicted-stockout banners live in Inventory; a "Stock Velocity" card lives in Reports — both driven by sales-velocity calculations, not a static low-stock threshold.
4. **Push notifications** (Firebase Cloud Messaging, native-only — no-ops on web/Expo Go) alert owners when daily sales deviate significantly from normal, or when stockout is predicted soon. Toggle lives in Profile. On receipt, a native `Alert` offers "Dismiss" / "View" (routes to Inventory or Reports depending on alert type).
5. **Offline-first list/cache.** TanStack Query is persisted to `AsyncStorage` (24h max age); the global `OfflineIndicator` banner communicates connectivity state without blocking interaction — designs should assume actions can be queued/optimistic rather than hard-blocked when offline.

---

## 7. Platform conventions to preserve

- Bottom sheets, not centered dialogs, for all contextual forms/confirmations.
- iOS tab bar: translucent blur, floating. Android tab bar: solid, bordered. Don't unify these — they intentionally follow each platform's convention.
- Safe-area insets are handled by `Screen`/`BottomSheet`/tab layouts already — new screens should compose with these rather than re-deriving insets.
- Haptic feedback (`expo-haptics`, light impact) fires on every `Button` press by default — keep this for any new primary actions unless there's a specific reason to suppress it.

---

## 8. Screen inventory

| Screen | Role | Notes |
|---|---|---|
| Splash | — | animated, native splash cross-fades into it |
| Login | — | no header |
| Register | — | modal |
| Forgot password | — | modal |
| Verify email | — | locked navigation until verified |
| Onboarding | — | locked navigation |
| Dashboard | Owner/Staff | metrics, low-stock list, recent transactions, sales summary |
| Inventory (list) | Owner/Staff | paginated, fast/slow-mover filters, stockout banners |
| Inventory new/edit | Owner | `ProductForm`, type-specific fields |
| Sales | Owner/Staff | cart, checkout flow per product type, filters |
| Staff (list/new/edit/detail/permissions) | Owner only | |
| Reports | Owner only | trend chart, stock velocity card, ratings rollup |
| Expenses | Owner/Staff | sheet-based add/edit |
| Profile | Owner/Staff | account info, password change; owner also gets shop settings |
| Receipt verification | Public | unauthenticated, QR-linked, web-compatible, rating capture |
| Help | Owner/Staff | index + article pages |

---

*Source of truth: this document reflects the implementation as of the latest commit on `main`. If tokens or components in `constants/`/`components/ui/` change, update this file alongside the code change.*
