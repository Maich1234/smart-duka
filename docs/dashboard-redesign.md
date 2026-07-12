# Home Dashboard Redesign — Business Command Center (July 2026)

The Home screen was rebuilt around one test: **within five seconds of opening the app the owner
must know (1) how the business is doing today, (2) whether anything needs their attention, and
(3) what to do next.** Everything that doesn't serve one of those three questions moved off the
screen.

---

## 1. Audit of the previous dashboard

### Information architecture problems

| # | Issue | Why it hurt |
|---|-------|-------------|
| 1 | **Analytics mixed with operations** — "Business Insights" cards (Products, Stock Value, Growth) sat between Quick Actions and alerts. | Static inventory counts aren't a *today* decision. They interrupted the action flow and pushed urgent content below the fold. |
| 2 | **A permanent "Growth" card that always showed "—"** | A metric that never renders data trains users to ignore the whole row (banner blindness). |
| 3 | **Recent Transactions rendered all 10 items** | ~700 px of feed dominated the scroll; the dashboard became a ledger instead of a control center. No "View All" exit, so the long list *had* to carry the history job. |
| 4 | **Low-stock alerts triple-reported** — header dot, "Low Stock" insight card, and a "Smart Alerts" section with a summary banner + 5-row list. | Duplicate information inflates scan time without adding certainty. The summary banner restated what the list below it already said. |
| 5 | **No urgency hierarchy** — alerts always rendered a heavy amber block, whether 1 item or 10, and unsynced sales / open shifts never surfaced at all. | The screen couldn't distinguish "calm day" from "problem day", and the two genuinely offline-first risks (unsynced sales, unclosed shift) were invisible. |
| 6 | **Nothing answered "so what?"** — raw totals with no comparison (vs yesterday), no profit, no best-seller. | Owners had numbers but no meaning; every judgment required mental math or a trip to Reports. |
| 7 | **Nested horizontal scroll** inside the vertical scroll (insight card carousel). | Gesture conflict on Android, and content hidden off-screen to the right is content that doesn't exist for most users. |

### Interaction & visual problems

| # | Issue | Why it hurt |
|---|-------|-------------|
| 8 | **Fake "LIVE" badge** with an infinite pulse animation — data actually refreshed only on focus/pull. | Dishonest status erodes trust the first time it's caught stale; the always-on animation also burned frames and battery. |
| 9 | **Four saturated gradient action cards + animated decorative circles on each.** | Four competing color fields = no visual priority; New Sale (90 % of usage) had the same weight as Reports. Subtitles ("Record transaction") added reading with zero information. |
| 10 | **1.5 s count-up on the hero number and staggered entrance delays up to ~800 ms.** | The single most important number was unreadable for over a second on every visit; the stagger made the app *feel* slower than it is. |
| 11 | **Notification bell showed a plain dot and secretly navigated to Inventory.** | Undiscoverable, single-purpose, and unlabeled — a dot can't say how much is wrong or about what. |
| 12 | **Error state blocked the whole screen even when cached data existed.** | Directly violated offline-first: an offline relaunch with a full cache still showed "Could not load dashboard". |
| 13 | Layout math from `Dimensions.get('window')` at module scope. | Wrong after rotation/fold/split-screen; flex handles this for free. |
| 14 | 36+ px touch targets (bell 40, badges smaller), meta text at 10–11 px with `rgba(255,255,255,0.5)` on dark. | Below the 44 px Android target guidance and low-contrast for sunlight readability — most users are outdoors on mid-range Android screens. |
| 15 | Transaction rows led with **invoice number and a staff-initial avatar in hash-random colors**. | The avatar color encoded nothing; invoice numbers are for lookup, not for a glance. The amount — the thing owners scan — was small and right-aligned. |

---

## 2. New information architecture

Priority is now literal top-to-bottom order. One purpose per section; every card is actionable.

```
P1  DashboardHeader     who/when + honest alert badge (count = Needs Attention items,
                        tap scrolls to that section)
P1  TodayCard           how is my business today? (sales, trend vs yesterday, profit,
                        sales count, payment-split bar)
P1  DailyBrief          what does it mean? (≤4 locally generated sentences + View Insights →)
 ·  GettingStarted      (kept — self-retires after first week)
P1  QuickActions        what do I do next? (New Sale full-width primary + 3 quiet tiles)
P2  TrialBanner         (kept — self-hides when healthy)
P2  NeedsAttention      only real problems: low/critical stock, unsynced sales, open
                        shifts — the entire section unmounts when empty
P3  RecentActivity      4 rows max + View All → Sales history
──  removed             Business Insights (Products / Stock Value / Growth) → these live
                        in Inventory and Reports, which is where those decisions happen
```

Component tree (`components/dashboard/`):

- `DashboardHeader.tsx` — pure presentational; badge count and scroll-to callback injected.
- `TodayCard.tsx` — memoized hero; count-up shortened to 700 ms; trend chip renders only when
  `yesterdaySalesTotal` exists (graceful with old backends).
- `DailyBrief.tsx` — renders `utils/dailyBrief.ts` output; not a chatbot, no network.
- `QuickActions.tsx` — `primaryRoute` + up to 3 `tiles`; flex layout, no Dimensions math.
- `NeedsAttention.tsx` — renders `AttentionItem[]`; returns `null` when empty.
- `RecentActivity.tsx` — slice(0, 4), method-tinted icon chip, amount-first rows,
  relative timestamps (`formatRelativeTime`), View All.

Shared logic (reused by owner *and* staff screens):

- `hooks/useAttention.ts` — `useOwnerAttention(data)` / `useStaffAttention()`: derives ranked
  attention items from dashboard data + offline queue + shift feature flag.
- `hooks/useOfflineQueue.ts` — `useSyncExternalStore` view of the SQLite outbox (pending count,
  syncing flag).
- `utils/dailyBrief.ts` — deterministic rule engine, ≤4 bullets ordered by decision value:
  trend → best seller → expenses/profit → restock. Pure function; trivially unit-testable.

Deleted: `SalesSummaryCard.tsx`, `StatsRow.tsx`, `LowStockList.tsx`, `RecentTransactions.tsx`.

---

## 3. Backend contract additions (`GET /dashboard/owner`)

All new fields are **optional on the client** — an older deployed backend keeps working, the UI
simply hides the trend chip/profit stat and the brief falls back to count-based phrasing.

| Field | Type | Feeds |
|---|---|---|
| `yesterdaySalesTotal` | number | TodayCard trend chip, brief bullet 1 |
| `todayProfit` | number | TodayCard Profit stat (item `subtotal` − current `costPrice` × qty; same convention as stock value) |
| `todayExpensesTotal` | number | brief bullet 3 |
| `topProduct` | `{name, quantity, revenue} \| null` | brief bullet 2 |
| `openShiftsCount` | number | Needs Attention (gated by `shiftManagementEnabled` client-side) |

Also: the eleven sequential awaits became one `Promise.all`, `lowStockItems` is now sorted by
quantity ascending (worst first) and field-selected, and `recentTransactions`/`recentSales`
dropped from 10 to 5 documents (home shows 4). `/dashboard/staff` gained `yesterdaySalesTotal`.

---

## 4. Design decisions worth remembering

- **Offline-first**: the brief is generated on-device from the (persisted) dashboard query —
  there is no AI call to fail or cache. Full-screen error now appears only when there is *no*
  cached data; otherwise the last synced day renders and pull-to-refresh stays available.
- **Honesty over theater**: LIVE badge → real trend chip; notification dot → numeric badge that
  mirrors the Needs Attention count and scrolls to it.
- **Calm by default**: white-surface cards with hairline borders + `Shadows.sm`; the single dark
  brand-gradient hero (navy→teal, gold figure) is retained as the identity anchor. Gradients on
  secondary elements removed; ambient looping animations removed.
- **Motion budget**: one `ScreenFade` per screen; press feedback via the existing `pressto`
  `AnimatedPressable` (UI-thread). No per-row entrance stagger.
- **One-handed reach**: New Sale is a full-width 56 px button directly under the fold-line
  content; all touch targets ≥ 44 px.
- **Numbers**: `fontVariant: ['tabular-nums']` on all money so digits don't jitter during
  count-up and columns align.
- **FlashList deliberately not used here**: the screen renders ≤ 4 list rows inside a
  ScrollView; virtualization would add overhead, not remove it. (It's already used on the real
  lists: sales history, inventory, expenses.)

## 5. Follow-ups

- `todayProfit` uses the product's *current* costPrice; if historical cost accuracy starts to
  matter, snapshot `costPrice` onto sale items at sale time.
- Consider a dedicated Insights screen evolution of Reports (the brief's "View Insights" already
  points there).
- Unit tests for `buildDailyBrief` and `useOwnerAttention` ranking would be cheap and high-value.
