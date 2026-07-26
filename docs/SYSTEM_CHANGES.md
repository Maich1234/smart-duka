# Smart Duka — Pre-Launch System Changes

**Status:** All changes implemented and verified — see §2 for the deploy order
and §5 for the three things that still need a human decision.
**Opened:** 2026-07-26
**Trigger:** Owner-side QA report + full-system audit (Play Store readiness, scalability, UX)
**Repos in scope:** `smart-duka` (mobile), `smart-duka-backend`, `smart-duka-web`

---

## 0 · Why this document exists

Smart Duka is about to be submitted to the Google Play Store. An audit of the
QA report plus an independent sweep of all three repos found:

- one **product gap that makes the app unusable for its largest user segment**,
- four **hard Play Store rejection/removal risks**,
- two **billing defects** (one overcharge, one revenue leak, one open bypass),
- two **performance defects** that will show up at the counter, not in testing.

This document is the plan of record. Every change is numbered, has an owner
repo, and has a definition of done. Items are ordered by *launch gate*, not by
effort.

---

## 1 · Strategic decisions taken

### 1.1 Subscription checkout moves off the mobile app entirely

**Decision:** the Android/iOS app will contain **no purchase flow of any kind**.
All subscription purchase, plan selection, promo codes, and payment recovery
live in the Next.js web app on Vercel.

**Why:** Google Play's Payments policy requires Play Billing for in-app
purchases that unlock app functionality. Our subscription gates reports,
analytics, AI, and drives the lock screen — squarely inside the policy.
Shipping in-app M-Pesa checkout risks removal, not a warning.

This is the standard B2B SaaS pattern on Play (Xero, Zoho, Salesforce). The
policy is satisfied by having *no* purchase UI in the app — not by having a
smaller one.

**Consequences accepted:**

- **Seat purchases must go too.** A staff-seat STK push is equally an in-app
  purchase. See §3.4 — the fix is to stop charging at seat-creation time
  altogether, which independently resolves the proration overcharge.
- **Anti-steering: no link, no button, no URL in the app.** The lock screen
  may state subscription status and stop there. It may not say "subscribe at
  …", render a tappable link, or deep-link to the web checkout.
- **Steering happens outside the app.** Renewal push notifications, the
  notification inbox, and email may contain full links to the web checkout.
  This is compliant and is now the primary renewal funnel — it must be
  reliable before mobile checkout is removed.
- **The web checkout is not currently good enough to be canonical.** It must
  reach parity first (§3.2). Removing mobile checkout before that breaks
  renewals for every existing shop.

### 1.2 The Help & Learning Center consolidates onto the Vercel web app

**Decision:** the canonical Help Center is `smart-duka-web` (Next.js, Vercel).
The Expo web export stops serving help, and the mobile repo stops carrying
help content.

**Why:** there are currently **two** help centers, and the good one is on the
wrong host:

| Location | What it is | Content |
|---|---|---|
| `smart-duka/constants/helpTopics.ts` + `app/help/*.web.tsx` | The real Help Center, served from the Expo web export | 14 topics, 7 categories, 483 lines of written content |
| `smart-duka-web/src/app/help/page.tsx` | A shell on the marketing site | 153 lines, topic cards with article *titles* only, no article bodies |

Native already links out to the Expo web export via `utils/openHelp.ts` — the
`app/help/*.tsx` files are redirect stubs, not screens. **So this is not a UX
removal.** It is a hosting consolidation with three wins: a smaller mobile
bundle, a single source of truth, and help articles that become indexable
organic-acquisition pages on the marketing domain.

**Consequence accepted:** help requires a network connection. It already did on
native. Mitigated by §3.11 (a small offline "first aid" set stays in-app).

### 1.3 Owners get the POS

**Decision:** owners can record sales in the app.

**Why:** the majority of Kenyan dukas are owner-operated with zero staff. See
§3.1 — today they cannot sell at all.

---

## 2 · Launch gate and deploy order

| ID | Change | Repos | Priority | Status |
|---|---|---|---|---|
| 3.1 | Owner can record a sale | mobile | **P0** | ✅ done |
| 3.2 | Web subscription checkout reaches parity | web | **P0** | ✅ done |
| 3.3 | Remove subscription checkout from mobile | mobile | **P0** | ✅ done |
| 3.4 | Seat creation stops charging in-app (prorated, postpaid) | backend, mobile, web | **P0** | ✅ done |
| 3.5 | Account deletion, 14-day window (in-app + web URL + API) | all three | **P0** | ✅ done |
| 3.6 | Privacy policy, terms, dead links | web | **P0** | ✅ pages live; Data Safety form still to submit |
| 3.7 | Close the `updateStaff` seat-billing bypass | backend | **P0** | ✅ done |
| 3.8 | `userInterfaceStyle: light` | mobile | **P0** | ✅ done |
| 3.9 | Help Center ported to Vercel, removed from mobile | web, mobile | **P0** | ✅ done — confirm the domain (§5) |
| 3.10 | Sales transactions retry on write conflict | backend | P1 | ✅ done |
| 3.11 | Local product cache for POS search | mobile | P1 | ✅ done |
| 3.12 | Server-side gating + staff grace + per-shop extension | backend | P1 | ✅ done |
| 3.13 | AI chat history | mobile | P1 | ✅ done |
| 3.14 | Pin the Gemini model | backend | P1 | ✅ done (fallback chain) |
| 3.15 | `deleteStaff` decrements `staffCount` | backend | P1 | ✅ done |
| 3.16 | Cheaper sales-list count | backend | P2 | ✅ done |
| 3.17 | Full dark mode | mobile | v2 | deferred |
| 3.18 | Swahili localisation | all | v2 | deferred |
| 3.19 | Barcode scanning | mobile | v2 | deferred |
| 3.20 | One front end, one URL | mobile, web | **P0** | ✅ done |
| 3.21 | Terms consent, recorded server-side | all three | **P0** | ✅ done |

### Deploy order — this matters

1. **Backend first.** The mobile app now calls `GET /staff/seat-preview`,
   `GET /auth/me/deletion-preview`, `POST /auth/me/restore`, and
   `DELETE /auth/me`, and no longer handles `409 SEAT_PAYMENT_REQUIRED`.
   Shipping the app before the API means adding staff appears to fail.
2. **Web second.** It is now the *only* place a subscription can be bought.
   Ship it before the app build that removes checkout, or existing shops have
   no way to renew.
3. **Mobile last**, and only once 1 and 2 are live.

Set the Vercel cron secret for the new job before step 1 completes, or
`/cron/account-deletions` 401s and scheduled closures never complete.

### Verification run at time of writing

- Backend: **166/166 tests pass**; app boots with all routes resolved.
- Web: TypeScript clean; `next build` succeeds; all 14 help topics
  statically generated, plus `/privacy`, `/terms`, `/delete-account`.
- Mobile: TypeScript clean; ESLint reports **no new** errors or warnings
  against the pre-change baseline (new files are entirely clean).

---

## 3 · The changes

### 3.1 — Owner can record a sale · **P0** · mobile

**Problem.** `app/(owner)/dashboard.tsx:198` renders the full-width primary CTA
labelled **"New Sale"** pointing at `/(owner)/sales`. That destination is a
read-only history and analytics screen — no cart, no product picker, no
checkout. The POS with a cart exists only at `app/(staff)/sales.tsx`.

**An owner cannot record a sale in this app.** For an owner-operated duka —
the majority of the target market — the core job-to-be-done is unreachable,
and the most prominent button on the home screen is a dead end.

**Fix.** Extract the POS from `app/(staff)/sales.tsx` into a shared component
and mount it at `/(owner)/pos`. Point the dashboard's primary CTA there.
Relabel the existing sales-history CTA "View Sales".

**Done when:** an owner with no staff can complete a cash sale and an M-Pesa
sale end to end, and the sale is attributed to the owner in reports.

---

### 3.2 — Web subscription checkout reaches parity · **P0** · web

**Problem.** The web checkout is a thin subset of mobile's and cannot yet be
the only way to pay.

| Surface | Mobile | Web |
|---|---|---|
| Subscription screen | 664 lines | 187 lines |
| Pay modal | 674 lines | 204 lines |
| Plan cards / plan switching | ✅ | ❌ |
| Promo codes | ✅ | ❌ |
| Monthly ⇄ yearly toggle | ✅ | ❌ |
| Paste-SMS payment recovery | ✅ | ❌ |

**Fix.** Port `components/subscription/PlanCards.tsx` and the missing paths of
`SubscriptionPayModal.tsx` to `smart-duka-web`. The backend endpoints already
exist and need no change.

**Done when:** a new owner can pick a plan, apply a promo code, choose yearly,
pay by M-Pesa, and recover a stuck payment by pasting the SMS — entirely on
the web, on a phone-sized viewport.

**Blocks:** 3.3.

---

### 3.3 — Remove subscription checkout from mobile · **P0** · mobile

**Fix.**

- Delete `app/(owner)/subscription.tsx` (664 lines),
  `components/subscription/PlanCards.tsx`, `SubscriptionPayModal.tsx`.
- Replace with a **status-only** screen: current state, renewal date, plan
  name. No price CTA, no payment button, no external link.
- `TrialBanner.tsx` keeps counting down but loses its "Renew" action.
- The `locked` redirect at `app/(owner)/_layout.tsx:206` now lands on the
  status screen, which explains the shop is paused and stops there.
- Remove the subscription tab from the owner tab registry.

**Anti-steering guardrail — do not add any of these:** a URL string, a
`Linking.openURL` call, a "Manage online" button, a QR code, or copy naming
the website.

**Done when:** grep for `smartduka.` / `http` in the subscription surface
returns nothing, and no purchase affordance exists in either app build.

**Blocked by:** 3.2.

---

### 3.4 — Seat creation stops charging in-app · **P0** · backend, mobile, web

**Three problems, one fix.**

1. *Play risk.* `app/(owner)/staff/new.tsx:95` handles `SEAT_PAYMENT_REQUIRED`
   by firing an M-Pesa STK push — an in-app purchase.
2. *Overcharge.* `seatPaymentController.js:102` charges
   `projectedAmount - currentAmount` — a **full billing period**, with no
   proration and no extension of `currentPeriodEnd`. Add a cashier on day 28
   of a monthly cycle and the owner pays KES 210 for two days, then pays again
   48 hours later. On **yearly** billing it is a full discounted year —
   **KES 2,016 for a seat added in month 11**.
3. *UX.* A blocking payment wall lands at the exact moment an owner is trying
   to onboard their first cashier.

**Fix.** Seats become **postpaid**:

- `createStaff` stops returning `409 SEAT_PAYMENT_REQUIRED`. The staff account
  is created and active immediately.
- The seat delta is **prorated for the remainder of the current period** and
  recorded against the subscription as a pending charge.
- At renewal, the invoice is `newHeadcountTotal + accruedProratedSeatCharges`.
- Mobile shows a non-blocking confirmation: *"This adds ~KES X to your next
  bill on <date>."* — a disclosure, not a checkout.
- Retire `POST /staff/seat-payment` and its recheck/reconcile siblings from the
  mobile client. Keep the endpoints alive for the web app if it still offers
  pay-now, otherwise delete after one release.

**Done when:** an owner on Starter can add a cashier with no payment
interruption; the next invoice reflects a prorated amount; and no STK push is
reachable from the mobile binary.

---

### 3.5 — Account deletion, with a 14-day cooling-off window · **P0** · all three

**Problem.** Play policy requires apps with account creation to provide
in-app account deletion **and** a publicly reachable web URL for deletion
requests. Neither existed — no route in `authRoutes.js` or `shopRoutes.js`, no
UI anywhere. This is an automatic rejection.

**Decision: closure is scheduled, not immediate.** Deleting an owner account
destroys a whole business and every staff account under it. That is far too
much damage to allow from one mistaken tap, a borrowed unlocked phone, or an
argument between an owner and a family member. So `DELETE /auth/me` schedules
closure **14 days out**; the account keeps working normally throughout, shows a
persistent banner, and one tap calls it off.

This stays inside Play policy: the requirement is an in-app deletion that is
genuinely initiated with a stated completion date, and a recovery window is
expressly permitted. Getting *in* is deliberately effortful (password + typed
`DELETE`); getting back out is deliberately trivial (one button, no password —
making it hard to undo would defeat the safety it exists to provide).

**Fix.**

- Backend: `DELETE /auth/me` schedules; `POST /auth/me/restore` cancels;
  `GET /auth/me/deletion-preview` reports consequences and any pending
  schedule. `purgeScheduledDeletions()` does the real destruction, driven by a
  new `/cron/account-deletions` job (daily, 03:00), which also pushes a
  reminder in the final 3 days. Owner closure cascades to the shop, its staff,
  and the subscription; financial records (`Sale`, `SubscriptionPayment`,
  `MpesaTransaction`) are retained per statutory bookkeeping requirements with
  personal identifiers detached — stated in the privacy policy (§3.6), which is
  what makes it a lawful retention rather than a silent one.
- Mobile: `components/profile/DeleteAccountSection.tsx`, mounted in both the
  owner and staff profiles. Shows the pending-closure card with a "Keep my
  account" button whenever one is scheduled.
- Web: a `/delete-account` page reachable without logging in, per policy.

**Done when:** closure can be scheduled and cancelled from the app, the cron
purges on time, the web URL is live and linked from the Play listing, and the
retention carve-out is documented.

---

### 3.6 — Privacy policy, terms, Data Safety · **P0** · web

**Problem.** `src/app/page.tsx:441` and `src/app/(auth)/register/page.tsx:152`
both link `href="#"`. No `/privacy` or `/terms` route exists. Play Console
requires a live privacy policy URL and a Data Safety declaration that matches
it. Automatic rejection.

**Must be declared** — the app collects: names, emails, phone numbers,
**financial transaction data**, device identifiers, and county/sub-county
location.

**Must also be declared:** business data is sent to **Google Gemini**
(`services/ai/geminiClient.js`) — a third-party data share. The in-app privacy
sheet at `components/profile/SmartDukaAiSection.tsx:105` is good practice but
is not a substitute for either the policy or the Data Safety form.

**Fix.** Write `/privacy` and `/terms` pages, wire up every dead link,
complete the Data Safety form, and audit the merged AAB manifest for
permissions injected by autolinked libraries that we cannot justify.

---

### 3.7 — Close the `updateStaff` seat-billing bypass · **P0** · backend

**Problem.** The July 2026 seat-billing fix hardened `createStaff`. It did not
touch `staffController.js:124` — `updateStaff` accepts `isActive: true`
(whitelisted at `staffValidation.js:36`) with **no seat-impact check**. Any
deactivated staff row, including one orphaned by an abandoned seat payment,
can be reactivated for free. Same exploit, different endpoint.

**Fix.** Route reactivation through the same accrual path as §3.4 so
head-count changes are always billed, whichever endpoint causes them.

---

### 3.8 — `userInterfaceStyle: light` · **P0** · mobile

**Problem.** `app.json:9` declares `"automatic"`, but `hooks/useTheme.ts:19`
hardcodes `isDark: false`. We tell Android the app supports dark mode while
rendering light-only, so on a dark-mode phone the OS darkens native chrome —
keyboards, system alerts, autofill overlays, share sheets, selection handles —
against white screens. This is what the QA report saw as "no theming."

**Fix.** One line: `"automatic"` → `"light"`. Real theming is §3.17.

---

### 3.9 — Help Center ported to Vercel · **P0** · web, mobile

**Fix.**

1. Port `constants/helpTopics.ts` (14 topics, 7 categories) into
   `smart-duka-web`.
2. Rebuild `/help` (index) and `/help/[slug]` as real Next.js pages, replacing
   the 153-line shell. Server-render for SEO; add metadata per topic.
3. Point `HELP_CENTER_URL` in `constants/config.ts` at the Vercel domain.
4. Delete from mobile: `constants/helpTopics.ts`, `app/help/*` (both native
   stubs and `.web.tsx`), and the Expo web export's help routes.
5. Keep `utils/openHelp.ts` and `components/help/HelpLink.tsx` — they now
   always open the browser.

**Done when:** every `HelpLink` in the app opens the correct Vercel article,
the mobile bundle no longer contains help content, and `/help/<slug>` renders
server-side with per-topic metadata.

---

### 3.10 — Sales transactions retry on write conflict · P1 · backend

**Problem.** `saleController.js:60-61` uses manual `startSession()` /
`startTransaction()` / `commitTransaction()` with **no retry loop**. Two tills
selling the same fast-moving SKU at the same moment produce a MongoDB
WriteConflict, and the sale returns a 500 — in front of a customer.

Compounding it: `saleController.js:73` does `await Product.findOne(...)`
**sequentially inside the item loop**. A 20-line basket is 20 serial round
trips holding the transaction open — longer locks, more conflicts.

**Fix.** Use `session.withTransaction(fn)`, which retries transient errors
automatically. Batch-load products with `$in` before the loop.

---

### 3.11 — Local product cache for POS search · P1 · mobile

**Problem.** `app/(staff)/sales.tsx:145` searches server-side, 10 items per
page:

- every search is a 350 ms debounce **plus** a network round trip on Kenyan
  mobile data;
- a 200-SKU shop means paging through 20 pages to browse;
- **offline, a term never searched before returns nothing** — the headline
  offline promise doesn't cover the most common POS action;
- the query has no `placeholderData: keepPreviousData`, so the grid **blanks
  on every keystroke**. `app/(owner)/sales.tsx` already does this correctly.

**Fix.** Sync the full product list into the existing SQLite DB
(`utils/offlineDb.ts`), search locally, delta-sync in the background. Add
`keepPreviousData`. While here, cache a small offline "first aid" help set
(§1.2) covering *sale didn't sync*, *can't log in*, *payment failed*.

---

### 3.12 — Server-side gating, staff grace, per-shop extension · P1 · all three

**Problem.** The QA report asked for an admin-configurable window during which
staff keep working after expiry. The premise is inverted — **staff are never
locked out at all**:

- `app/(staff)/_layout.tsx` has zero subscription gating (compare
  `app/(owner)/_layout.tsx:206`);
- web is the same — `src/app/(dashboard)/layout.tsx:47` gates on
  `user?.role === 'owner'`;
- server-side, only `aiRoutes`, `reportRoutes`, and `analyticsRoutes` use
  `requireActiveSubscription`. Sales, inventory, purchases, expenses, staff,
  shifts, and M-Pesa are ungated.

A locked shop keeps trading through staff accounts indefinitely, for free.
That is an unbounded revenue leak, not a disruption risk.

**Fix.**

1. Gate transactional routes server-side. Client-only gating is decoration.
2. Add a **staff grace window that outlives the owner's** — owner paywalled at
   day 0, staff keep selling for N more days. This is the humane behaviour the
   QA report was reaching for, and it is commercially right: a shop that can't
   sell churns; a shop that can't see analytics pays.
3. Add a **per-shop, admin-grantable extension** ("give this shop 7 more
   days"). Today `PlatformConfig.gracePeriodDays` is one global number for
   every shop — support has no lever for the owner who is KES 200 short until
   Friday.

---

### 3.13 — AI chat history · P1 · mobile, web

**Problem.** `hooks/useAiChat.ts:15` fetches `getConversations({ limit: 1 })`.
The backend already stores and paginates full history — only the UI discards
it. Worse, `chat.tsx:114` makes the previous thread **permanently unreachable**
when the owner starts a new one, which reads as "the app deleted my chat"; and
the plan-cap toast tells owners to "delete an old one" when they cannot see
any.

**Fix.** A history drawer over the existing endpoint. No API change needed.

---

### 3.14 — Pin the Gemini model · P1 · backend

**Problem.** `geminiClient.js:7` defaults to the floating alias
`gemini-flash-latest`. Google can change what that resolves to at any time,
shifting cost, latency, and — since `responseFormatter` parses structured
JSON — potentially breaking the output contract in production with no deploy
on our side.

**Fix.** Pin a dated model ID; roll forward deliberately.

---

### 3.15 — `deleteStaff` decrements `staffCount` · P1 · backend

`staffController.js:141` never decrements `subscription.staffCount`, so the
field drifts permanently out of sync with real head-count.

---

### 3.16 — Cheaper sales-list count · P2 · backend

`saleController.js:464` runs `countDocuments` on every sales page load. Fine
today; at 100k+ sales per shop it becomes the slowest part of the screen.
Switch to a `limit + 1` has-more probe or a cached count.

---

### 3.17 — Full dark mode · v2 · mobile

1,922 direct `Colors.*` references across `app/` and `components/`; only 4
files call `useTheme()`. Nearly all sit inside module-scope
`StyleSheet.create`, which evaluates once at import and cannot become dynamic
without a real migration. Codemod to a `useThemedStyles(fn)` hook. Budget 3–5
days. **Do not attempt before launch** — §3.8 is the launch answer.

---

### 3.18 — Swahili localisation · v2 · all

No i18n exists anywhere. Not a launch blocker — business English is normal in
Kenyan retail — but a real differentiator once we push past early adopters.

---

### 3.21 — Terms consent, recorded · **P0** · all three

**Problem.** The mobile app contained **no reference to the Terms of Service or
Privacy Policy anywhere** — not at signup, not in Profile. That's a Play
requirement failure on its own (the policy must be reachable inside the
product, not only from the store listing) and leaves no evidence of consent
under Kenya's Data Protection Act, 2019. The web app had only a passive line of
fine print under the signup button.

**Design decision: the checkbox goes at registration, not login or profile.**
Consent is a one-time affirmative act at the moment of signup. A blocking
checkbox at login would add friction to the screen a cashier opens every shift
while collecting no consent they hadn't already given, and on Profile an
untick has no coherent meaning — it can't retract a signed agreement, and
account closure (§3.5) is the actual way out. So:

| Surface | What it got |
|---|---|
| Registration (web + both mobile paths) | **Required checkbox**, immediately above the submit action |
| Login (web + mobile) | Terms / Privacy links — reachable, not a gate |
| Profile (web + mobile) | Legal section linking both documents |

**The part that makes it more than decoration.** A checkbox whose result is
never stored proves nothing, so consent is enforced and recorded server-side:

- `registerSchema` requires `acceptedTerms` to be **literally true**
  (`Joi.boolean().valid(true)`), so an unticked or omitted field is a
  validation failure rather than a silent pass.
- `register.js` re-checks it and refuses to create the account without it — a
  disabled button on the client is a suggestion, not a control.
- `User.termsAcceptedAt` and `User.termsVersion` record **which version was
  accepted and when**, against `CURRENT_TERMS_VERSION` in
  `src/constants/legal.js`. Bump that constant whenever either document
  changes materially.
- Staff accounts leave both fields null by design: staff are created by their
  owner rather than signing up, and the owner accepted on behalf of the
  business — which is what the terms themselves say.

Covered by `tests/termsAcceptance.test.js`, including that truthy-but-not-true
values (`'yes'`, `1`, `'on'`) are **not** accepted as consent.

**Found while doing this:** typing `acceptedTerms` as required surfaced a
*second* registration path — `app/(onboarding)/signup.tsx`, the premium
onboarding journey — which would otherwise have shipped able to create accounts
with no consent at all. Both paths now carry the checkbox.

---

### 3.20 — One front end, one URL · **P0** · mobile, web

The Smart Duka front end is **`https://smart-duka-web-delta.vercel.app`** (the
`smart-duka-web` Next.js app on Vercel). Everything the mobile app links out to
now resolves there, replacing two separate Expo web export hosts.

**Mobile** (`constants/config.ts`): `WEB_URL` is the single source, overridable
with `EXPO_PUBLIC_WEB_URL` so a preview deployment or a future custom domain
needs no code change. `HELP_CENTER_URL` and `PUBLIC_WEB_URL` both derive from
it. The trailing slash is stripped, which also fixes a latent bug — receipt QR
codes were encoding `…expo.app//r/<token>` with a doubled slash.

**Web**: added `metadataBase` (via `src/lib/site.ts`). Without it the relative
`alternates.canonical` values on every help, privacy, and terms page resolved
against `localhost` at build time and shipped wrong canonical tags — quietly
destroying the SEO value the Help Center move exists for. `SITE_URL` prefers
`NEXT_PUBLIC_SITE_URL`, then Vercel's own
`VERCEL_PROJECT_PRODUCTION_URL`, so preview deploys describe themselves
honestly and a custom domain works without an edit.

Also added, since crawlability was the point of §3.9:

- `sitemap.ts` — all marketing pages plus every help article.
- `robots.ts` — allows marketing and help; disallows dashboard, admin, auth,
  and `/r/` (public receipts).
- `app/r/[token]/layout.tsx` — `noindex` on receipts. Each is a per-sale token
  showing shop name, line items, and amounts; indexing them would publish a
  shop's takings one transaction at a time.

**Verified against the real build output:** canonical tags resolve to the
Vercel host, `sitemap.xml` lists all 12 help articles, `robots.txt` carries the
disallow rules.

**Known difference:** the Expo web export's receipt page offered an "open in
the app" deep link (`smartduka://r/<token>`); the Next.js receipt page does
not. Receipt QRs are scanned by customers, who mostly don't have the app, so
this was not worth porting. It does leave `app/(public)/r/[token].tsx` in the
native bundle unreachable from any current QR code — a cleanup candidate once
old printed receipts have aged out. Left in place for now so deep links from
receipts already in circulation still resolve.

---

### 3.19 — Barcode scanning · v2 · mobile

No scanner today. Fine for loose-goods dukas; a gap for kiosks selling branded
FMCG. Revisit when moving upmarket.

---

## 4 · Verified as healthy

Recorded so future audits don't re-litigate these:

- Indexes on `Sale`, `Product`, and `Purchase` are shop-scoped and
  well-chosen.
- `parsePagination` clamps limits and guards `NaN`.
- The offline SQLite outbox is sound.
- Assets are down to 136 KB.
- 52 direct dependencies — lean for the feature surface.
- Auth: JWT refresh rotation with reuse detection, one-device-per-staff
  sessions, rate-limited login/OTP backed by a shared Upstash store.

---

## 5 · Still needs a human decision

1. ~~Confirm the production web domain.~~ **Resolved — the front end is
   `https://smart-duka-web-delta.vercel.app`.** See §3.20 for what that
   settled.
2. **Submit the Play Data Safety form.** The pages exist (§3.6) but the form is
   a Play Console action nobody can do from the repo. It must declare: name,
   email, phone, financial transaction data, device IDs, county/sub-county —
   and **sharing with Google Gemini**. It has to match `/privacy` exactly.
3. **Statutory retention period** for financial records after account closure
   (§3.5). The privacy policy currently says these are retained as accounting
   records without naming a period. A Kenyan bookkeeping answer would let us
   state one.
4. **Deep-link domains in `app.json` were left pointing at the Expo hosts**
   (`associatedDomains`, `intentFilters`) — the only Expo references left
   anywhere. They were deliberately *not* switched to the Vercel domain,
   because `autoVerify` app links only work if the host serves proof of
   ownership:
   - Android: `/.well-known/assetlinks.json`, containing
     `com.wabunifu.smartduka` and the **SHA-256 fingerprint of the release
     signing key** (`eas credentials` → Android → Keystore).
   - iOS: `/.well-known/apple-app-site-association`, containing the Team ID +
     bundle ID.

   Pointing the config at a host that serves neither would silently downgrade
   every app link to opening the browser. Switching them is a small change once
   someone supplies the fingerprint — the files go in
   `smart-duka-web/public/.well-known/`. Until then the current hosts keep
   working, so nothing is broken; it is just the last piece of the
   consolidation still outstanding.

## 6 · Noted, deliberately not changed

- **`requirePaidShop` fails open.** If the subscription lookup itself errors,
  the request proceeds. A false lock at the counter during a database blip is
  worse than a few unbilled transactions, so an outage must never stop a shop
  selling. Deliberate; tested.
- **Void and refund are not subscription-gated.** They are corrections, not new
  trading. Blocking them would punish the shop's *customers* for the owner's
  unpaid bill.
- **`POST /auth/me/restore` needs no password.** Getting into a destructive
  action is deliberately effortful; getting out of it is deliberately trivial.
  An attacker who could call this already holds a valid session.
- **`/delete-account` on the web takes no credentials.** Collecting a password
  on an unauthenticated public page is a phishing-shaped pattern and an
  account-takeover vector. It explains the process and points at the in-app
  flow or a verified email request.
- **Legacy `/staff/seat-payment*` routes stay mounted** for one release so
  in-flight payments from older app builds can still reconcile. No current
  client initiates one. Remove after that release.
- **`PUBLIC_WEB_URL`** still points at the Expo web export for receipt QR
  codes. Same consolidation as §3.9 and worth doing, but out of scope here.
