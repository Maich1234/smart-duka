# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Primary: owners of small independent retail shops ("dukas") in Kenya — typically a single shop with one till and a handful of staff — who need to run day-to-day sales, inventory, and staff management without a dedicated back office. Secondary: their staff (cashiers/attendants), a scoped-permission role that rings up sales and manages stock/expenses within whatever access the owner grants, without staff management or full reporting access.

## Product Purpose

DuQana is a point-of-sale, inventory, and shop-management app for small Kenyan retail shops. It lets an owner run sales, track stock, manage staff, record expenses, and see financial reports from a phone, and lets staff ring up sales and manage stock within their permissions. Success means the shop keeps operating and getting paid — via M-Pesa or owner-defined payment methods — even when connectivity is unreliable, and the owner can trust the numbers (sales, stock, staff activity, commissions) without manual reconciliation.

## Positioning

An offline-first architecture (actions queue locally and sync when connectivity returns) combined with M-Pesa as a first-class till/payment method rather than a bolted-on integration. A competitor built assuming steady connectivity, or a generic card-first checkout with M-Pesa as an afterthought, could not truthfully make the same claim.

## Operating Context

- Kenyan retail shops (Kenya county/sub-county location data, KES currency).
- Devices are often lower-end Android phones on intermittent or limited connectivity.
- M-Pesa is the dominant payment rail; owners can also define their own till payment methods.
- Subscription SaaS billing (trial → grace → lock); staff seats are postpaid and prorated, never blocking account use on payment.
- Staff frequently have no personal email address (a system-generated fallback address exists for this case).
- The typical owner runs one shop location with a small staff roster, not a multi-branch chain.

## Capabilities and Constraints

- Six product types drive different checkout interactions: standard, variable-price, weighted/refillable (per kg/L), service, bundle, and configurable (variant).
- Barcode scanning, Bluetooth/BLE thermal receipt printing, QR-coded receipts with a public, unauthenticated verification + rating page.
- Role-based permissions (owner vs. staff), shift management + reconciliation, a purchasing/suppliers module, refunds (M-Pesa reversal + cash).
- An AI chat assistant ("Bella") for shop questions/insights, gated by subscription tier.
- No in-app purchase for subscription/seat payments (Google Play policy compliance) — payment happens via a scoped webview or external link, never a native in-app-purchase button.
- Must degrade gracefully offline; actions are queued/optimistic rather than hard-blocked on connectivity.

## Brand Commitments

Product name: **DuQana** (`app.json` → `expo.name`). The Expo slug stays `smart-duka` for technical reasons — a project's slug is bound to its EAS `projectId` for life and cannot be renamed. Support/web domain: `duqana.co.ke`.

## Evidence on Hand

None established yet — no testimonials, case studies, or press on hand. Future work must not fabricate these.

## Product Principles

1. Never let a network hiccup block a sale, stock update, or shift action — queue and sync, don't hard-block.
2. M-Pesa and owner-defined payment methods are core to checkout, not an add-on bolted onto a generic flow.
3. Staff-facing UI stays inside its permission scope by default; the fuller surface is owner-facing.
4. Design for a phone in one hand, in a shop, often on a budget device — not a desktop-first assumption ported down.
5. Numbers the owner relies on (sales, stock, commissions, reconciliation) must be trustworthy without needing a manual double-check.

## Accessibility & Inclusion

A stated product requirement, not aspirational: design for low digital literacy, low literacy/language barriers (favor icons, numbers, and minimal text over dense copy), visual impairment (real contrast and legible type sizes, not just polish), and older users with reduced dexterity (larger touch targets, minimal reliance on complex gestures) — on top of the baseline low-end-device/spotty-connectivity constraint already built into the app's architecture.
