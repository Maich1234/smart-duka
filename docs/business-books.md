# Business Books — Phased Specification (July 2026)

Dukana already captures everything a small business does: sales, purchases, purchase costs,
expenses, stock movement. This module turns that operational record into **downloadable business
books** the owner can hand to a bank, a SACCO, a landlord, or KRA — without ever asking them to
keep an accounting record by hand.

The guiding rule: **the user records business activity; Dukana produces the books.**

---

## 0. Decisions

| Decision | Choice | Why |
|---|---|---|
| **Monetization** | One feature flag, `books`, on the existing `SubscriptionPlan.features[]`. Sold as a third plan tier (§4) — **not** an à-la-carte add-on marketplace. | M-Pesa has no card-on-file. Every à-la-carte toggle is a fresh STK Push and a new subscription amount; 14 independent SKUs is a combinatorial reconciliation surface on top of the tier + seat-billing axes that already exist. Unbundling later is easy; re-bundling is not. |
| **What ships first** | Only books that are **100 % derivable from data Dukana already captures**. | Six of the sixteen books in the original concept (Trial Balance, Balance Sheet, Cash Flow, Customer Ledger, Supplier Ledger, Tax Summary) have no inputs in the current schema. Shipping an approximated Balance Sheet that a shopkeeper takes to a lender is worse than not shipping one. |
| **Where books are computed** | Server-side, always. Client caches the generated file for offline viewing. | A financial statement is a document, not a view. On-device computation from partially-synced SQLite would produce numbers that disagree with the server's — for figures that go to a bank. |
| **Ledger posting** | Not gated. Every shop's data is book-ready from day one; only the **output** is gated. | If posting were behind the paywall, a shop activating in November would have no books for the ten months before it. |
| **AI's role** | Reads finished books. Never writes a record, never computes a figure that appears in a book. | Preserved from the original concept — it is the correct rule. |
| **Lapsed subscription** | Books already generated stay readable and re-downloadable. Only *new* generation is gated. | Revoking access to someone's financial records is both a bad look and a records-retention problem. |

### Explicitly not being built

- A Business Add-ons Marketplace with per-feature checkout.
- Double-entry accounting, chart of accounts, journal entries, Trial Balance, Balance Sheet.
- Any book requiring receivables, payables, capital/equity, fixed assets, or VAT — see §6.

---

## 1. Phase 0 — Correctness prerequisites (blocking)

These are not features. They are defects that only become visible once a number leaves the app as a
document. **No book may ship before its inputs are fixed.**

### 0.1 Snapshot cost of goods on the sale line — *blocks P&L, blocks everything profit-related*

`Sale.items[]` stores `unitPrice` but **no cost**. Gross profit is computed in
[`dailySummaryService.js:66-76`](../../smart-duka-backend/src/services/dailySummaryService.js#L66-L76)
by `$lookup`-ing the product's **current** `costPrice`:

```js
estCost: { $multiply: ['$quantity', { $ifNull: [{ $arrayElemAt: ['$product.costPrice', 0] }, 0] }] }
```

Because the purchasing module rewrites `costPrice` on every landed-cost allocation, **July's profit
changes whenever August's stock arrives.** Regenerating a July P&L in September yields a different
number than the one downloaded in August. That is acceptable for a live dashboard tile; it is
disqualifying for a signed-looking PDF.

**Fix:** add to `saleItemSchema` — mirroring how `commissionAmount` already snapshots a value so
"later config changes never retroactively alter historical earnings":

```js
unitCost:  { type: Number, default: null, min: 0 },  // landed cost at sale time
costTotal: { type: Number, default: null, min: 0 },  // quantity × unitCost, stored not derived
```

Populated at sale creation from `product.costPrice`, or `variant.costPrice` when `variantId` is set.
`null` means "pre-snapshot sale" — books must label periods containing them as **Estimated** rather
than silently mixing the two costing methods. Optional backfill script may populate historical rows
from current cost, but must mark them estimated.

### 0.2 Payment method on Expense and Purchase — *blocks the Cashbook*

A Cashbook records money **in and out of a specific pot**. Today:

- `Expense` has no payment method — [`Expense.js`](../../smart-duka-backend/src/models/Expense.js)
- `Purchase` has no payment method and no payment status — [`Purchase.js`](../../smart-duka-backend/src/models/Purchase.js)

So an expense paid by M-Pesa is indistinguishable from cash taken out of the till, and a purchase
taken on credit looks identical to one paid immediately. A Cashbook built on this is fiction.

**Fix:** add to both models:

```js
paymentMethod: { type: String, enum: ['cash', 'mpesa', 'bank', 'credit'], default: 'cash' },
```

`credit` on a Purchase means *no cash moved* — it must be excluded from the Cashbook and is the
seed of the future Creditors book (§6). Both UIs need the selector; default `cash` keeps every
existing record and the offline queue valid.

### 0.3 Emit stock movements from sales — *blocks Stock Movement Report*

[`InventoryMovement.js`](../../smart-duka-backend/src/models/InventoryMovement.js) documents its own
gap:

> Currently only written by the Purchasing module — Sale/void/refund stock changes are NOT
> retrofitted to emit these yet.

The `reason` enum already reserves `sale`, `sale_void`, `refund`. Wire `saleStockService` to emit
movements on the same paths that currently do bare `product.quantity +=`. Until then a Stock
Movement Report shows stock arriving and never leaving.

### 0.4 Period immutability

Once a month's books have been generated and downloaded, that month is **closed**: the stored
artifact is the record. Regeneration is allowed but produces a **new version**, and both remain
listed with their generation timestamps. Never silently replace a document the owner may have
already emailed to a lender.

---

## 2. Phase 1 — The seven books

Every one of these is fully derivable once Phase 0 lands.

| # | Book | Sources | Notes |
|---|---|---|---|
| 1 | **Cashbook** | `Sale` (by `paymentMethod`), `Expense`, `Purchase` (excluding `credit`) | Chronological money-in / money-out with running balance, split into Cash / M-Pesa / Bank columns. The flagship book. |
| 2 | **Sales Register** | `Sale` | Invoice no., date, staff, items, discount, method, status. Voided/refunded rows shown and excluded from totals — same status rules as `REVENUE_STATUSES`. |
| 3 | **Purchase Register** | `Purchase` | Supplier (or walk-in label), items, products total, additional costs, grand total. `pending_approval` and `cancelled` shown separately. |
| 4 | **Expense Register** | `Expense` | Grouped by the seven existing categories, with period totals and category share. |
| 5 | **Purchase Cost Report** | `Purchase.additionalCosts[]` | Landed-cost breakdown across the ten cost categories, plus allocation method used. Already-unique data; no other POS in this market reports it. |
| 6 | **Inventory Valuation** | `Product` (+ variants) | Quantity on hand × cost price, and × selling price, per product and total. Point-in-time — dated, not a period. |
| 7 | **Stock Movement Report** | `InventoryMovement` | Opening qty, in, out, closing qty, per product. Requires 0.3. |
| 8 | **Profit & Loss (simplified)** | Sales, snapshotted COGS, Expenses | Revenue → COGS → **Gross profit** → operating expenses by category → **Net profit**. Labelled *Simplified Profit & Loss* — not an IFRS statement, and the PDF says so. |

Ordering in the UI is by usefulness to a duka owner, not by accounting convention: Cashbook and P&L
first.

---

## 3. Architecture

### 3.1 One shape, many renderers

The failure mode to avoid: sixteen books × three formats = forty-eight renderers. Every book service
returns the **same normalized document**, and the renderers are written once.

```ts
// shared shape, backend → client
interface BookDocument {
  key: BookKey;                  // 'cashbook' | 'sales_register' | ...
  title: string;                 // "Cashbook"
  shop: { name: string; currency: string; ownerName: string };
  period: { from: ISODate; to: ISODate; label: string };  // "July 2026"
  columns: { key: string; label: string; align: 'left'|'right'; type: 'text'|'money'|'number'|'date' }[];
  sections: {
    label?: string;              // e.g. an expense category group
    rows: Record<string, string | number>[];
    subtotals?: Record<string, number>;
  }[];
  totals: Record<string, number>;
  footnotes: string[];           // "Costs estimated for 12 sales before 1 Aug 2026."
  meta: { generatedAt: ISODate; estimated: boolean; version: number };
}
```

- `src/services/books/<book>Service.js` — one per book, produces a `BookDocument`. Pure aggregation,
  no formatting.
- `src/services/books/renderers/{pdf,csv,xlsx}.js` — one per format, consume any `BookDocument`.
  Adding a book costs one service, zero renderers.
- `src/services/books/registry.js` — maps `BookKey` → service + display metadata + required
  `Shop` toggle (e.g. Purchase Register requires `purchasingEnabled`).

Neither `pdfkit`/`puppeteer` nor `exceljs` is currently a backend dependency — this is a greenfield
choice. Recommend **pdfkit** (no headless Chrome on the server) and **exceljs**.

### 3.2 Routes

Extend [`reportRoutes.js`](../../smart-duka-backend/src/routes/v1/reportRoutes.js), which today
exposes only `GET /sales`:

```
GET  /api/v1/reports/books                     → catalogue: available books, last generated, locked/unlocked
POST /api/v1/reports/books/:key/generate       → { from, to, format } → GeneratedBook
GET  /api/v1/reports/books/generated           → history, newest first
GET  /api/v1/reports/books/generated/:id/file  → download (signed, shop-scoped)
POST /api/v1/reports/books/bundle              → generate all available books for a period → single ZIP/PDF
```

All behind `ownerOnly, requireActiveSubscription, requireFeature('books')`, following the exact
pattern already in use at `reportRoutes.js:10`. Generation is `idempotency`-wrapped — the middleware
exists and a double-tapped "Generate" on a flaky connection must not bill work twice.

New `GeneratedBook` model: `{ shop, key, period, format, fileUrl, sizeBytes, estimated, version,
generatedBy, generatedAt }`. This is what makes §0.4 and the lapsed-subscription policy possible.

### 3.3 Offline model

- Generation **requires connectivity**. It is a server operation, and it is not queued — same
  reasoning as `/auth/` never being queued: a stale-input financial document is worse than no
  document.
- The catalogue and every already-generated file are cached locally. Offline, the Books screen is
  fully browsable and every downloaded book re-opens; only the Generate button is disabled, with
  "Connect to generate new books" — never a blocking error screen.
- Follow the established `isConnected !== false` policy; do not pre-emptively block on a flaky
  NetInfo reading.

---

## 4. Phase 2 — Billing

The structure below is chosen for what it costs to *extend*, not for what it earns on day one. The
failure mode to design against is SKU and tier proliferation: if every new book is a pricing
decision, a marketing decision and a billing migration, you arrive back at the add-ons marketplace
by accident within a year.

### 4.1 Three levels, permanently

Commit to never adding a fourth. Every future capability lands in an existing level by answering one
question.

| Level | The question it answers | Contains |
|---|---|---|
| **Starter** — KES 210/staff | *Can I run my shop?* | sell, stock, staff, M-Pesa, dashboards, AI insights |
| **Pro** — KES 350/staff *(new)* | *Do I know my money?* | the eight books now; Debtors, Creditors, Supplier/Customer Ledger later — at no new price |
| **Business** — KES 2000 flat | *Can I scale and comply?* | Pro + advanced analytics, priority support; later Tax/eTIMS, multi-branch, accountant export |

A Cash Flow Statement is "know your money" → Pro. eTIMS is "comply" → Business. The routing rule is
unambiguous, so no future book needs a tier invented for it.

**Why Pro is per-staff, not flat.** Any flat Pro price mathematically cannot sit between Starter's
range (210 × 1…9 = 210–1890) and Business (2000) without cannibalising one of them. Per-staff keeps
the ladder monotonic and makes revenue grow with the customer's business automatically:

| Staff | Starter | Pro | Business |
|---|---|---|---|
| 1 | 210 | **350** | 2000 |
| 3 | 630 | **1050** | 2000 |
| 5 | 1050 | **1750** | 2000 |
| 6 | 1260 | 2100 | **2000** ← natural crossover |

Books demand tracks business sophistication, not headcount — a shop needs a Cashbook when it applies
for a loan, not when it hires a tenth employee. Putting `books` on Business alone would make the
upgrade trigger *"hire seven more staff to get your Cashbook"* and monetise it to almost nobody,
since most dukas are 1–3 people.

All of these numbers are DB-driven — `subscriptionDefaults.js` only seeds an empty collection — so
the price points and crossover are tunable from the super-admin page without a release.

### 4.2 One flag per pack, not per book

`features[]` gets `'books'` — **not** `books_cashbook`, `books_pnl`, `books_debtors`. The registry
(§3.1) decides which books exist; the plan decides whether the shop gets books at all.

This is what makes shipping book #15 free commercially: it drops into the registry and every Pro
subscriber has it in the next release. No migration, no checkout change, no repricing event. If one
book ever needs to be Business-only (Tax Summary), add a **second** flag `books_advanced` — not a
fifteenth.

Do **not** remove `reports` or `ai_insights` from Starter. Both plans ship them today; pulling them
back to resell is a repricing that takes capability away from paying customers.

### 4.3 Make "how much books" a data question — mirror `chatLimits`

This problem is already solved once in this codebase: `SubscriptionPlan.chatLimits` holds per-tier AI
quotas in the database, enforced server-side by `enforceChatLimits`. Do the same:

```js
bookLimits: {
  maxGenerationsPerMonth: { type: Number, default: null, min: 0 },  // null = unlimited
  allowedKeys: { type: [String], default: null },                   // null = all books in this level
  formats: { type: [String], default: ['pdf', 'csv', 'xlsx'] },
},
```

The free-trial hook then costs no code: Starter gets
`{ maxGenerationsPerMonth: 1, allowedKeys: ['cashbook'], formats: ['pdf'] }`, set from the
super-admin page. Books are a feature nobody understands from a pricing table and everybody
understands after seeing their own money in one — one free generation will convert better than any
copy. Promos, throttling an expensive tier, or testing a cheaper "books lite" all become document
edits rather than releases.

### 4.4 Grandfather by versioning the plan, not the subscriber

Already works today with **zero schema change**. `Subscription.plan` is an ObjectId ref, and
`active: true` filters only the catalogue —
[`subscriptionController.js:35`](../../smart-duka-backend/src/controllers/subscriptionController.js#L35)
is its sole consumer. Entitlement flows through the populated ref in `requireFeature`.

So when Pro holds fourteen books and is worth 500/staff: create a new `pro-v2` plan document and set
`active: false` on `pro`. It disappears from the pricing screen; every existing subscriber keeps
their price and keeps working indefinitely.

Raising prices for new customers while existing ones are grandfathered is the normal way SaaS grows
revenue — and it is only available if a tier is a *bundle*. With per-feature add-ons every price
change is a renegotiation with every customer.

### 4.5 Locked-state UX

The Business Books screen is visible to everyone. Locked books render with their real names and a
one-line description of what they contain, plus the period selector — the owner sees exactly what
they'd get. Generate → upgrade sheet. Never hide the feature behind an empty state.

---

## 5. UI

### Entry point

`Profile → Business Books` — a single row, not a marketplace. Sits with the business-management
group alongside Reports, above account settings, in
[`profile.tsx`](<app/(owner)/profile.tsx>).

### Business Books screen — `app/(owner)/books/index.tsx`

```
Business Books
Your records, ready to download.

┌─ Period ──────────────────────────┐
│  July 2026                      ▾ │   ← month picker; Custom opens a range
└───────────────────────────────────┘

[ Generate all books ]                 ← primary; disabled + reason when offline

Books

  Cashbook                        ›
  Money in and out · Updated today
  Simplified Profit & Loss        ›
  Revenue, costs, profit · Updated today
  Sales Register                  ›
  Purchase Register               🔒
  ...
```

Each row: name, one-line plain-English description, last-generated timestamp or "Not generated
yet". No accounting jargon anywhere in the primary label — "Money in and out" carries the meaning,
"Cashbook" carries the authority.

### Book detail sheet — `app/(owner)/books/[key].tsx`

Period (inherited, editable) → Format (PDF / Excel / CSV) → Generate → preview summary + Share.
Previously generated versions of the same book listed underneath with their timestamps.

Reuse existing primitives — `pressto` press-scale, the haptics facade, shimmer skeletons while
generating. Generation is a network round-trip on a mid-range Android on 3G: the button enters a
determinate-feeling progress state, never a spinner over a blank screen.

### Client dependencies

Mobile has `expo-print` (PDF from HTML, already used by receipts) but **neither `expo-file-system`
nor `expo-sharing`** — both are required to save and share a downloaded file. Add them in Phase 1.
Web reuses the browser download path.

---

## 6. Phase 3 — Books that need data capture first

Each of these is **a feature to build, not a report to render.** Listed in recommended order, which
is by value to a Kenyan duka owner — not by accounting convention. A shopkeeper does not want a
Trial Balance; they want to know who owes them money.

| Book | Must first build | Size |
|---|---|---|
| **Debtors Book** (who owes me) | `Customer` model; customer on `Sale`; credit sales with part-payment and settlement; ageing | Large — highest value in this list |
| **Creditors Book** (what I owe) | `Purchase.paymentStatus`, `amountPaid`, `dueDate`, settlement records against `Supplier` | Medium — 0.2 already seeds it |
| **Supplier Ledger** | Creditors, above | Small once Creditors exists |
| **Customer Ledger** | Debtors, above | Small once Debtors exists |
| **Tax Summary** | VAT config, tax-inclusive/exclusive pricing, eTIMS field capture | Large — but likely a stronger monetization hook than any statement below |
| **Cash Flow Statement** | Financing and investing activity (loans, capital injections, drawings, asset purchases) | Large |
| **Trial Balance / Balance Sheet** | Chart of accounts, double-entry journal, opening balances, equity, fixed assets, depreciation | Very large — a product in its own right |

Recommendation: **Debtors and Creditors before anything statement-shaped.** They answer questions
owners ask daily, they are the natural next data capture, and each unlocks a book almost for free.

---

## 7. Phase 4 — AI over books

Once `BookDocument` exists, the AI layer gets a structured, already-computed input instead of raw
collections.

- AI receives the finished `BookDocument` (or its `totals` + section subtotals) and produces prose:
  what changed, what it means, what to do.
- **AI never computes a figure that appears in a book, and never writes a record.** Every number it
  cites must be traceable to a book it was handed. This is the rule that keeps the books
  defensible.
- Attach to the P&L and Cashbook first: "Your profit rose 12 % on July. Transport costs rose 8 % —
  they are now 14 % of expenses."
- Gated by the existing `requireFeature('ai_insights')` **and** `requireFeature('books')`; reuses
  `enforceChatLimits` quotas. No new AI plumbing.

---

## 8. Sequencing

| Phase | Contents | Ships |
|---|---|---|
| **0** | Cost snapshot on sale lines · payment method on Expense/Purchase · sale stock movements · `GeneratedBook` model + period immutability | Nothing user-visible. Non-negotiable. |
| **1a** | `BookDocument` + PDF/CSV renderers + registry · Cashbook · Simplified P&L · Sales Register | First release worth paying for |
| **1b** | Purchase Register · Expense Register · Purchase Cost Report · Inventory Valuation · Stock Movement · Excel renderer · bundle export | Completes the eight |
| **2** | `books` feature flag · plan placement · locked-state UX | Monetization on |
| **3** | Debtors → Creditors → their ledgers | Next data-capture cycle |
| **4** | AI narration over books | After 1a exists |

Phase 0 is the whole risk. Everything after it is mechanical.
