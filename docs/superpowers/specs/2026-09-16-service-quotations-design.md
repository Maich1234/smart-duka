# Service Quotations — Design Spec

Date: 2026-09-16
Branch: feat/customer-credit (mobile), companion changes in smart-duka-backend and smart-duka-web
Status: Approved for implementation

## Problem

Service-oriented shops (plumbers, salons, contractors, etc.) want to give a
customer a professional, itemized price proposal *before* any money changes
hands or any stock moves — something that looks like a real business
quotation, not a till receipt. Today the app has no such document: every
`Sale` line item requires a catalog `productId`, and a sale always has
immediate stock/credit effects.

## Terminology

- **Quotation** — a draft price proposal. No financial effect. Not a `Sale`.
- **Sale** — the existing, unchanged financial record. A quotation becomes
  one only when explicitly converted.
- "Invoice" in the original ask is this Quotation flow — the word is kept
  out of the schema/UI to avoid confusion with `Sale.invoiceNumber`, which is
  an unrelated, pre-existing concept (the receipt/tax document number for a
  completed sale).

## Goals

1. Owner/staff (permission-gated) draft a quotation for a customer: pick a
   customer, add line items (catalog service products and/or free-text
   custom lines), see a computed total.
2. The quotation renders as one of a few genuinely distinct professional
   templates, chosen once by the shop as a default (web-rendered only, to
   keep the mobile bundle small).
3. Share it: printable web page, a public read-only link, a downloadable
   PDF, an email with the PDF attached, and one-tap WhatsApp/social sharing
   of the link.
4. If the customer accepts, convert the quotation into a real `Sale` via the
   existing sale-creation pipeline (stock, commission, credit — unchanged
   rules), payable by any method the shop already supports, including
   credit (same `make_credit_sale` + credit-limit/blocked-customer checks as
   a till credit sale).
5. If declined, the owner deletes or archives the quotation. Nothing to
   reverse — nothing financial was ever created.

## Out of scope (explicitly)

- No per-quotation template override — one default per shop.
- No customer-facing accept/decline action on the public page (view/print/
  download only). Acceptance is something the shop hears and acts on.
- No WhatsApp Business API integration — sharing is a `wa.me` deep link with
  a pre-filled message, same tier of effort as a "Share" button anywhere
  else in the app.
- No headless-browser PDF rendering — PDFs are drawn directly with a
  lightweight library (`pdfkit`), matching the serverless backend.
- No shop-level "default validity days" setting — the mobile date picker
  defaults to +30 days and staff can change it per quotation.
- Till/POS sale creation is untouched. Free-text line items are reachable
  only through quotation → convert-to-sale, not through the regular cart.

## Data model

### New `Quotation` model (backend)

```
shop: ObjectId (ref Shop, required, indexed)
customer: ObjectId (ref Customer, required)
customerSnapshot: { name, phone, email }   // captured at creation time
quoteNumber: String                          // QUO-YYMM-NNNNN, own per-shop counter
items: [{
  productId: ObjectId (ref Product, optional),
  name: String (required),                   // catalog product name, or free text
  description: String (optional),            // free-text line detail
  quantity: Number (required, min 0.001),
  unitPrice: Number (required, min 0),
  subtotal: Number (required),
}]
subtotal: Number
taxRate: Number        // snapshotted from Shop.taxRate at creation
taxAmount: Number
total: Number
notes: String (optional, maxlength 500)
validUntil: Date
status: 'draft' | 'declined' | 'expired' | 'converted'
convertedSale: ObjectId (ref Sale, default null)
createdBy: ObjectId (ref User, required)
createdByName: String
timestamps: true
```

Indexes: `{ shop: 1, createdAt: -1 }` (list screen), `{ shop: 1, status: 1 }`
(filters), `{ shop: 1, quoteNumber: 1 }` unique (mirrors the Sale
`invoiceNumber` fix — per-shop uniqueness, never global).

`status: 'expired'` is computed at read time from `validUntil < now` for
display purposes (badge color), not written by a cron — a quotation with no
financial effect doesn't need a sweep job. It can still be converted after
its `validUntil` has passed; that's a business call for the owner, not a
system-enforced rule.

### `Shop` additions

```
quotationTemplate: String, enum ['classic', 'modern', 'minimal'], default 'classic'
quotationFromEmail / shared platform no-reply address (env var, not per-shop)
```

### `Sale` / `saleItemSchema` change

`productId` becomes optional (was `required: true`). A quotation's
free-text line converts into a `Sale` item with `productId: undefined`,
`unitCost: null`, `costTotal: null` — reusing the *existing* "cost unknown,
report this period as Estimated" semantics already documented on
`unitCost`, so no new schema field is needed for "this is a custom line."

**Ripple-effect audit required during implementation** (this is the main
technical risk in the whole feature): every place that currently assumes
`item.productId` exists must be checked and made to skip items without one,
not crash or silently miscount:
- Stock decrement / negative-stock alert loop in `saleController.createSale`
- Best-seller / product-performance aggregations in reporting
- Commission calculation (a custom line has no commission config to read —
  it simply earns none)
- Purchasing/COGS rollups in the books module

## Permissions

Add to `ALL_PERMISSIONS` (category `Quotations`):
- `create_quotation` — draft, edit, delete/archive a quotation; send it by
  email or generate its share link/PDF.
- `convert_quotation_to_sale` — turn an accepted quotation into a real
  `Sale`. Converting to a *credit* sale still independently requires
  `make_credit_sale` (no dependency shortcut) — the point raised during
  design is that these two grants stay orthogonal on purpose, the same way
  `refund_all_sales` implies `view_all_sales` but nothing implies
  `refund_all_sales`.

`DEFAULT_STAFF_PERMISSIONS` is unchanged — both are opt-in, matching how
`make_credit_sale` is opt-in today.

## Backend API

All routes shop-scoped from `req.user.shop._id`, never from the request
body/params, matching every existing controller.

- `POST /quotations` — create (requires `create_quotation`)
- `GET /quotations` — list, paginated, filter by `status` (requires
  `create_quotation` or `convert_quotation_to_sale` — either grant can see
  the list; a staff member who can only convert still needs to see what's
  waiting)
- `GET /quotations/:id` — detail
- `PATCH /quotations/:id` — edit while `status: 'draft'` only
- `PATCH /quotations/:id/decline` — sets `status: 'declined'` (the "mark
  inactive" action)
- `DELETE /quotations/:id` — hard delete, only while `status: 'draft'` or
  `'declined'` (never once `converted` — the audit trail to its `Sale`
  matters)
- `POST /quotations/:id/convert` — body carries whatever the till checkout
  already carries (`paymentMethod`, `mpesaTransactionId`/manual code,
  `customerId` implied by the quotation). Requires
  `convert_quotation_to_sale` **and** whatever the resulting payment method
  already requires (`make_credit_sale` for credit). Idempotent via the
  existing idempotency middleware, and atomically transitions
  `status: draft -> converted` with a status-filtered update so a
  double-tap can never produce two Sales from one quotation.
- `GET /quotations/:id/pdf` — authenticated PDF download
- `POST /quotations/:id/send-email` — sends the default email with the PDF
  attached to `customerSnapshot.email`; 400 if there is none
- `GET /public/quotation/:token` — public read model (full itemization,
  never `costPrice`/commission — same redaction discipline as
  `sanitizeForStaff`)
- `GET /public/quotation/:token/pdf` — public PDF download
- New `utils/quotationToken.js`, mirroring `receiptToken.js` exactly
  (stateless signed JWT of the quotation id, no expiry on the token itself —
  the page shows a "this quotation is no longer valid" notice once
  `validUntil` has passed, which is a display concern, not a token concern)

### Convert-to-sale implementation note

`saleController.createSale` is a single `(req, res)` handler; duplicating
its stock/commission/credit logic for the convert endpoint is the wrong
call given how many races have already been fixed in that exact code path
(see prior "double-sale race on M-Pesa linking" and "createSale race"
history). Implementation must extract the post-validation core of
`createSale` into an internal function callable by both the existing HTTP
handler and the new convert endpoint, so there remains exactly one place
that creates a `Sale`.

## PDF generation

`services/quotationPdfService.js` using `pdfkit`. One render function per
template (`classic`/`modern`/`minimal`) that draws directly — no HTML
intermediate, no headless browser, no new heavy dependency on the
serverless backend. Each template's PDF layout must be visually consistent
with its HTML counterpart (same header treatment, same table layout, same
accent color use) even though they are two separate implementations.

## Email

Reuses the existing `utils/email.js` sender. New env var for the from
address (user will supply the no-reply mailbox). Default subject/body
copy (drafted here, adjustable at implementation time):

> Subject: Quotation {{quoteNumber}} from {{shopName}}
>
> Hi {{customerName}},
>
> {{shopName}} has sent you a quotation for {{total}}. The itemized
> breakdown is attached as a PDF, and you can also view it online:
> {{publicLink}}
>
> This quotation is valid until {{validUntil}}.
>
> Thank you for considering {{shopName}}.

## Sharing

On the web quotation page (owner/staff view):
- "Share via WhatsApp" — `https://wa.me/{customerPhoneDigitsIfKnown}?text=`
  + URL-encoded message containing the public link. Falls back to a
  number-less `wa.me/?text=...` when the customer has no phone on file.
- "Copy link" button.
- Web Share API (`navigator.share`) as a progressive-enhancement "share to
  anything" option where the browser supports it; the two buttons above
  remain as the reliable baseline.

On mobile (Quotations list): a "Share link" row action using React Native's
built-in `Share.share()` — text + the public URL only. Ships no rendering
or PDF code, so it costs nothing in bundle size. Email, PDF download, and
WhatsApp-with-full-message-composition stay web-only, opened through the
in-app browser (`expo-web-browser`), matching the existing Setup
Guide/help pattern.

## Web templates

Three templates (`classic`, `modern`, `minimal`), each genuinely distinct
in typography/color/layout treatment, not just recolored copies of one
layout. Rendered by:
- `smart-duka-web/src/utils/quotationHtml.ts` (mirrors the existing
  `receiptHtml.ts` pattern) — used for the authenticated owner/staff view,
  print (`window.print()`, A4-sized, not the 280px thermal width), and the
  public `/q/[token]` page.
- Shop settings gains a template picker next to the existing
  logo/motto/thank-you-note controls, writing `Shop.quotationTemplate`.

Standard invoice-style fields across all three templates: shop
name/logo/address/phone, "Quotation" label + `quoteNumber`, issue date,
valid-until date, bill-to (customer snapshot), itemized table
(description/qty/unit price/line total), subtotal/tax/total, notes, and a
"this is a quotation, not a tax invoice" footer disclaimer.

## Mobile

New screens (owner + permission-gated staff):
- **Create Quotation** — customer picker (reuses the existing credit/POS
  customer picker), line items (product picker filtered to
  `productType: 'service'`, or "Add custom line" with description/qty/
  rate), notes, valid-until date (defaults +30 days), running total.
- **Quotations list** — status badges (draft/declined/expired/converted),
  row actions: View (opens the web page via `expo-web-browser`), Share
  link (native `Share.share()`), Convert to Sale (routes into the existing
  till checkout UI pre-filled with the quotation's items/customer),
  Decline, Delete.
- Both new permissions surfaced as checkboxes in the existing staff
  permission-editing screens (mobile and web), under a new "Quotations"
  category — same list/UI pattern as every other permission there.

## Security considerations

- Every quotation endpoint scoped by `req.user.shop._id`; convert requires
  the layered permission check described above (never a shortcut around
  `make_credit_sale`).
- Public endpoints (`/public/quotation/:token`, `.../pdf`) never expose
  `costPrice`, `unitCost`, or commission fields — same redaction as
  existing staff/public sanitization.
- Convert-to-sale is idempotency-guarded and uses an atomic
  status-filtered update, so a retried or double-tapped request cannot
  produce two Sales from one quotation (mirrors the existing unique
  `{ sale: 1 }` partial index pattern on `CreditTransaction`).
- `quotationToken.js` mirrors `receiptToken.js`'s stateless-JWT design
  exactly — no new secret-handling pattern introduced.
- A full `/security-review` pass runs after implementation, before merge.

## Testing expectations

- Backend: unit tests for quote-number sequencing (concurrent claims, no
  collisions — mirrors existing `invoiceNumberService` tests), the
  createSale-core extraction (existing createSale tests must still pass
  unchanged), convert-to-sale idempotency (duplicate request produces one
  Sale), permission gating (each new permission independently required),
  and public-endpoint redaction (no cost/commission fields ever present).
- Web: template rendering smoke tests for all three templates, PDF/email
  endpoints mocked at the HTTP boundary.
- Mobile: manual QA pass on Create Quotation → Share → Convert-to-Sale,
  since this repo does not run automated UI tests today.
