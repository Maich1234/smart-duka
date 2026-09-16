# Customer Credit & Loyalty (Sep 2026)

Duqana already lets a shop sell on account ("Deni") to a named customer. This spec covers the
one part of the original ask that is genuinely unbuilt: a **Loyalty Program** (points +
purchase-frequency rewards), designed to slot into the same architecture Credit already proved
out. It also documents Credit's current, already-implemented state so this doc is a complete,
self-contained reference for the whole "Customer Credit and Loyalty" initiative — and so nobody
re-designs or re-builds what already exists.

---

## 0. Status & scope

| Piece | Status | Where |
|---|---|---|
| Customer Credit — backend | **Shipped**, unmerged | `smart-duka-backend` branch `feat/customer-credit`, commit `f9ddf67` |
| Customer Credit — mobile | **Shipped**, unmerged | `smart-duka` branch `feat/customer-credit`, commit `50ffefa` |
| Customer Credit — web | Not built | Deferred, see §3 |
| Loyalty Program — backend | **This spec** | New |
| Loyalty Program — mobile | **This spec** | New |
| Loyalty Program — web | Not built | Deferred, see §3 |

Both branches carry uncommitted-to-`main` work; this initiative continues on the same
`feat/customer-credit` branch in both repos rather than opening a new one.

---

## 1. Customer Credit — already built (reference only, do not re-design)

**Data model.** `Customer` (shop-scoped contact + a `credit` rollup: `limit`, `blocked`,
`outstanding`, `overdueAmount`, `oldestDueAt`, `status`, `totalExtended`, `totalRepaid`).
`CreditTransaction` — an immutable ledger, one row per sale/payment/correction/opening-balance,
never edited in place; corrections are compensating rows (`CREDIT_SALE_REVERSAL`,
`CREDIT_PAYMENT_REVERSAL`). `Shop.creditSettings` (`enabled`, `defaultCreditLimit`,
`defaultCollectionPeriodDays`, `productPolicy`, `overduePolicy`). `Sale.customer` /
`Sale.customerName` — present on **any** sale, not only credit ones (confirmed in
`saleController.js`: `customerId` is accepted and attached "so a shop can attach a regular to a
cash purchase," independent of payment method). This is the exact hook Loyalty reuses in §2.

**Rules that matter.** Collection periods: presets `[0, 3, 7, 14, 30]` days plus any custom
integer up to 365 (`constants/credit.js`); `dueAt` is computed once at sale time and frozen —
changing the shop's collection period later never moves an existing debt. The limit check and
the "repayment can't exceed balance" check are both a single conditional `findOneAndUpdate` with
the limit read at write time, so two tills selling to the same customer can't both push them over
the limit — enforced by MongoDB's write serialization, not application code. Idempotency: the
existing `X-Idempotency-Key` middleware, plus a unique partial index on
`CreditTransaction.clientRef`, plus a unique partial index on `CreditTransaction.sale` (one sale
→ at most one debt). A credit sale is `realtimeOnly` on the client (`services/sales.ts`) — it
skips the offline outbox entirely, because the balance/limit it's checked against can only be
enforced by a live server.

**Permissions.** Four, added to the existing flat permissions array (no new framework):
`make_credit_sale`, `view_own_credit`, `view_all_credit` (implies `view_own_credit`),
`record_credit_payment`. Changing a limit, blocking a customer, editing shop credit settings,
importing an opening balance, and reversing a posted entry stay owner-only.

**Endpoints** (`src/routes/v1/creditRoutes.js`, `customerRoutes.js`): `GET /credit/overview`,
`GET /credit/transactions`, `GET /credit/untracked-sales` (owner), `POST
/credit/customers/:id/payments`, `POST /credit/transactions/:id/reverse` (owner), `POST
/credit/opening-balances` (owner); `GET/POST/PUT/DELETE /customers`. `GET /customers/:id`
already returns a shaped account summary **plus** a paginated `transactions` ledger **plus** the
customer's last 5 `recentSales` — Loyalty extends this same response (§2.5) rather than adding a
parallel endpoint.

**Mobile.** Credit tab (`app/(owner)/credit/`), Customers section (`app/(owner)/customers/`,
`app/(staff)/customers/`), till Credit button + `CustomerPickerScreen`/`CustomerPickerSheet` +
`CreditSummarySheet` (server-verified balance shown before commit) + `RecordPaymentSheet`, all
under `components/credit/`. No new navigation shape or design system — `ScreenHeader`,
`ListRow`-style rows, `BottomSheet`, existing tokens throughout.

**Verified against the original spec:** global + per-customer limits ✓, presets + custom period
✓, due date frozen per-transaction ✓, limit/available/outstanding/paid/due-date/days-remaining/
overdue/history all surfaced on `CustomerAccountScreen` ✓, partial + full repayment ✓, staff
permissions respected ✓, immutable audit trail ✓. No gaps found against the spec as written.

---

## 2. Loyalty Program — design (new work)

Two independently-toggleable programs, one settings block per shop, one shared ledger. Deliberately
**one reward configuration per program** (not a rewards catalog) — the spec asks for a single
configurable reward per method, and a catalog is real added complexity a duka doesn't need yet.

### 2.1 Data model

`src/constants/loyalty.js` (pure, unit-testable, mirrors `constants/credit.js`):

```js
export const LOYALTY_TX_TYPES = {
  POINTS_EARNED: 'POINTS_EARNED',
  POINTS_REDEEMED: 'POINTS_REDEEMED',
  POINTS_EARNED_REVERSED: 'POINTS_EARNED_REVERSED',       // sale that earned points was voided/refunded
  POINTS_REDEEMED_REVERSED: 'POINTS_REDEEMED_REVERSED',   // sale that redeemed points was voided/refunded
  FREQUENCY_PROGRESS: 'FREQUENCY_PROGRESS',                 // +1 toward the next reward
  FREQUENCY_PROGRESS_REVERSED: 'FREQUENCY_PROGRESS_REVERSED',
  FREQUENCY_REWARD_REDEEMED: 'FREQUENCY_REWARD_REDEEMED',
  FREQUENCY_REWARD_REVERSED: 'FREQUENCY_REWARD_REVERSED',
};

export const REWARD_TYPES = ['PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_ITEM'];
export const LOYALTY_PRODUCT_POLICIES = ['ALL_PRODUCTS', 'SELECTED_PRODUCTS']; // parallels credit's, kept local — no shared import, so this feature doesn't touch credit.js

export const DEFAULT_LOYALTY_SETTINGS = {
  points: {
    enabled: false,
    earnRatePerKes: 100,        // KES spent (on eligible items) per 1 point earned
    productPolicy: 'ALL_PRODUCTS',
    eligibleProductIds: [],
    redemption: {
      rewardType: 'FIXED_DISCOUNT',
      pointsCost: 1,             // points consumed per reward "unit"
      rewardValue: 1,            // KES off per unit (FIXED_DISCOUNT) or % off (PERCENTAGE_DISCOUNT); ignored for FREE_ITEM
      rewardProductId: null,     // required when rewardType === FREE_ITEM
      minPointsToRedeem: 0,
    },
  },
  frequency: {
    enabled: false,
    purchasesRequired: 10,       // "buy 9 times, get the 10th..." -> threshold = 10
    productPolicy: 'ALL_PRODUCTS',
    eligibleProductIds: [],
    reward: {
      rewardType: 'FREE_ITEM',
      rewardValue: 100,
      rewardProductId: null,
    },
  },
};
```

`resolveLoyaltySettings(shop)` — same absent-subdocument-defaults pattern as
`resolveCreditSettings`. Pure helpers: `pointsEarnedFor(eligibleSubtotal, settings)` (floored),
`frequencyRewardDue(customer, settings)` (boolean).

`Shop.loyaltySettings = { points: {...}, frequency: {...} }` — same shape as the constants above,
merge-patched the same way `creditSettings` already is in `shopController.updateShop`
(`if (loyaltySettings !== undefined) shop.loyaltySettings = { ...resolveLoyaltySettings(shop), ...loyaltySettings }`),
with the same `logAudit({ action: 'loyalty.settings.updated', ... })` call.

`Customer.loyalty` rollup (derived cache, never source of truth — same reasoning as
`Customer.credit`):

```js
loyalty: {
  pointsBalance: { type: Number, default: 0, min: 0 },
  lifetimePointsEarned: { type: Number, default: 0, min: 0 },
  lifetimePointsRedeemed: { type: Number, default: 0, min: 0 },
  frequencyCount: { type: Number, default: 0, min: 0 },          // progress toward the next reward; resets to 0 on redemption
  frequencyRewardsRedeemed: { type: Number, default: 0, min: 0 }, // lifetime count, never resets
  lastEarnedAt: { type: Date, default: null },
  lastRedeemedAt: { type: Date, default: null },
}
```

`LoyaltyTransaction` — one immutable ledger shared by both programs, discriminated by `type`
(mirrors `CreditTransaction` exactly):

```js
{
  shop, customer,                          // same as CreditTransaction
  type: { enum: LOYALTY_TX_TYPES },
  program: { enum: ['POINTS', 'FREQUENCY'] },
  points: { type: Number, default: 0 },              // signed by type via a LOYALTY_TX_SIGN map, stored positive
  pointsBalanceAfter: Number,                        // snapshot, same reasoning as CreditTransaction.balanceAfter
  frequencyCountAfter: Number,                       // snapshot, for FREQUENCY_* rows
  rewardApplied: {                                   // frozen copy of what was actually given — never re-derived
    rewardType, rewardValue, rewardProductId, discountAmount,
  },
  sale: { ref: 'Sale' },
  reversalOf: { ref: 'LoyaltyTransaction', default: null },
  reversedBy: { ref: 'LoyaltyTransaction', default: null },
  reason: String,
  staff: { ref: 'User', required: true },
  staffName: String,
  shift: { ref: 'Shift' },
  clientRef: String,                                 // idempotency key, same role as on CreditTransaction
}
```

Indexes: `{shop, customer, createdAt: -1}` (timeline), `{shop, staff, createdAt: -1}` ("loyalty I
gave/redeemed"), unique partial `{sale: 1, type: 1}` — **not** just `{sale: 1}` like Credit,
because a single sale can legitimately produce more than one row (e.g. it earns points *and* is
the customer's 10th qualifying purchase *and* the cashier redeemed points on it — up to three
rows, never two of the same type), unique partial `{shop, clientRef}` (idempotency backstop).

### 2.2 Earning

Both programs reuse the same `ALL_PRODUCTS` / `SELECTED_PRODUCTS` eligibility shape Credit
already has. Points: `floor(eligibleSubtotal / earnRatePerKes)`. Frequency: **one qualifying
sale = +1** toward the count, regardless of how many eligible units are in it — matches "buy 9
*times*," not "buy 9 units."

Both are booked as an extra branch inside the existing `createSale` transaction, the same way
`bookDebt` already is — commits or rolls back atomically with the stock movement, the sale row,
and (when applicable) the credit debt. Because `Sale.customer`/`customerId` is already generic,
no new attachment plumbing is needed server-side; mobile needs a UI to attach a customer on a
non-credit sale (§2.6).

**This is why earning can safely go through the normal offline queue**, satisfying "earn
offline": it rides the same `createSale` request as the sale itself, whether that request fires
immediately or hours later when a queued sale syncs, and inherits the same idempotency-key
protection against a retried sale double-earning.

### 2.3 Redemption

**Realtime-only**, exactly like a credit sale (`realtimeOnly: true`, skips the offline outbox).
The points/count decrement is a single conditional `findOneAndUpdate` read-at-write-time — the
same pattern that makes the credit-limit check race-safe — so two tills can't both redeem the
same customer's last points, and it fails visibly offline rather than risking a double-redeemed
reward.

- **Points:** the cashier chooses how many `pointsCost`-units to redeem, up to the customer's
  balance and up to the cart total; discount = `unitsRedeemed × rewardValue` (FIXED_DISCOUNT) or a
  flat percentage per unit (PERCENTAGE_DISCOUNT), or adds/discounts `rewardProductId` (FREE_ITEM).
- **Frequency:** fires automatically once `frequencyCount` reaches `purchasesRequired` on a
  qualifying sale; discounts/frees one unit of a specific item **in that cart** — the configured
  `rewardProductId` for FREE_ITEM, or the cheapest eligible line for
  PERCENTAGE_DISCOUNT/FIXED_DISCOUNT when no specific product is configured. This matches "get the
  10th *item*," not the whole receipt. `frequencyCount` resets to 0 on redemption;
  `frequencyRewardsRedeemed` increments and never resets.

`rewardApplied` on the ledger row snapshots exactly what was given (type/value/product/computed
discount) at redemption time, so a later settings change never rewrites a receipt's history — same
principle as `CreditTransaction.dueAt` being frozen.

### 2.4 Permissions

One new permission, category "Loyalty": `redeem_loyalty_reward` — gates who may apply a
redemption at checkout, same trust-boundary pattern as `make_credit_sale`. **No new permission for
earning** — attaching a customer and letting them earn needs nothing beyond the existing
`record_sale`, mirroring how attaching a customer to a cash sale already needs nothing extra.
Configuring program settings, manually adjusting a balance, and reversing a redemption stay
owner-only, same as credit settings/limits/reversals today.

### 2.5 Backend endpoints

- Extend the existing shop-config `PUT` handler (`shopController.updateShop`) to accept
  `loyaltySettings`, merge-patched the same way as `creditSettings`; extend `shopConfigPayload` to
  include `loyaltySettings: resolveLoyaltySettings(shop)`.
- Extend `GET /customers/:id` (`customerController.getCustomerById`) to add a `loyalty` summary
  object (mirrors the existing `shaped` credit summary) and a paginated `loyaltyTransactions`
  array alongside the existing `transactions` (credit) array — same pagination params, same
  `scopedToSelf` flag, no new endpoint needed.
- New `POST /loyalty/customers/:id/redeem` (`staffOrOwner`, `requirePaidShop`,
  `redeem_loyalty_reward` permission, rate-limited like `creditWriteLimiter`, `idempotency`
  middleware) — the realtime redemption path called from the checkout confirmation sheet; wraps a
  `createSale`-equivalent commit when redemption happens as part of a new sale (see §2.6), or
  stands alone when a reward is claimed against an existing cart already submitted through
  `createSale`'s new `loyaltyRedemption` body field (implementation detail for the plan phase to
  settle: whether redemption is always inline in `createSale`, matching how credit sales are one
  branch of that same transaction, is the simpler and more consistent option and is the default
  going into planning).
- New `POST /loyalty/transactions/:id/reverse` (`ownerOnly`, mirrors
  `POST /credit/transactions/:id/reverse`) for manual corrections.
- Reversal on void/refund is **not** a new endpoint — it hooks into the existing
  void/refund controller path (§2.7).

### 2.6 Mobile UI

**Owner settings:** a `Loyalty` screen, peer to `app/(owner)/settings/credit.tsx` — two
independently-toggleable sections (Points, Frequency), each exposing its rate/policy/reward
fields. Built with `@expo/ui` grouped-form primitives (`Switch`, `Slider`/stepper, `FieldGroup`,
`List`/`ListItem`) rather than hand-rolled RN controls, per the native-UI default — this screen is
exactly the "settings-shaped content" `List` is meant for, not a virtualized list.

**Customer profile (`CustomerAccountScreen`):** a compact Loyalty section beside the existing
Credit section — points balance, a progress indicator toward the next frequency reward, and
redemption/earning history merged into the same timeline pattern already used for the credit
ledger (a `LoyaltyTransactionRow` sibling to `CreditTransactionRow`).

**Checkout (`PosScreen`/`CartSummary`):** generalize the cart store's `creditCustomer` into a
shared "attached customer" concept usable on **any** payment method, not only Credit — this is
the one piece of UI plumbing Credit didn't need but Loyalty does, since earning has to work on
ordinary cash/M-Pesa sales. When a customer is attached and a program is enabled, a small inline
chip (not a large card — per the "avoid clutter" brief) shows balance/progress with a "Redeem"
action, active only when eligible, opening a confirmation sheet in the same posture as
`CreditSummarySheet` (server-verified, nothing computed on-device) before the sale commits.

### 2.7 Reversal integration

Voiding or refunding a sale that earned points, advanced a frequency count, or redeemed a reward
must post the matching `*_REVERSED` row and roll back the `Customer.loyalty` rollup — hooked into
whatever controller path already reverses a credit debt on void/refund (`saleController.js`'s
existing void/refund handling, extended the same way it was already extended for credit).

### 2.8 Offline & duplicate-prevention summary

| Action | Path | Duplicate protection |
|---|---|---|
| Earn points / frequency progress | Normal offline queue (rides the sale itself) | Sale's own idempotency key + unique partial `{sale, type}` index |
| Redeem points or a frequency reward | Realtime-only, skips offline queue | Conditional `findOneAndUpdate` at write time + unique partial `{sale, type}` index + `clientRef` backstop |
| Manual correction/reversal (owner) | Realtime, owner-only | Same `clientRef` idempotency pattern as credit reversals |

---

## 3. Explicitly not being built

- Web dashboard pages for Credit or Loyalty (`smart-duka-web`) — Credit shipped without them;
  Loyalty follows the same precedent. Revisit as its own follow-up.
- A multi-tier or multi-reward loyalty catalog — one reward configuration per program.
- Per-product point earn rates — one global `earnRatePerKes`.
- Any new cron job for loyalty — unlike Credit's overdue sweep, nothing in loyalty ages or needs a
  scheduled scan.

---

## 4. Testing & verification approach

Mirrors Credit's own bar: pure-function unit tests for `constants/loyalty.js` (earn/redemption
math, eligibility), a `loyaltyService` test suite covering the ledger and concurrency (two
simulated tills redeeming the same customer's last points), and an authorization test suite
covering the one new permission and owner-only boundaries (same shape as
`creditAuthorization.test.js`). Mobile: component tests for the new settings screen and the
checkout redemption flow, plus `tsc` clean, matching the 47 tests the credit mobile commit shipped
with.

## 5. Open follow-ups for the implementation plan

- Whether checkout redemption is always inline inside `createSale` (recommended, for the same
  atomicity reason credit sales are) or a separate confirm-then-commit round trip against
  `POST /loyalty/customers/:id/redeem` — settle during planning against the exact shape of
  `PosScreen`'s existing credit-confirmation flow.
- Exact wording/placement of the checkout "attached customer" chip once it's generalized beyond
  Credit — small UI decision, not architectural.
