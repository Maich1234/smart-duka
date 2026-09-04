---
target: recent uncommitted changes (auth/owner-staff-layouts/inventory/payments/sales/ui-components), 2026-08-24
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
timestamp: 2026-08-24T06-16-09Z
slug: recent-changes
---
Method: dual-agent (A: design review · B: detector/pattern evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | OTP field's "OK" button can sit enabled while doing nothing |
| 2 | Match Between System and Real World | 3 | Copy is natural and domain-appropriate throughout |
| 3 | User Control and Freedom | 3 | Good back/cancel coverage; undercut by the OTP dead-button |
| 4 | Consistency and Standards | 2 | Two "leave sale" paths, different copy, different actual behavior |
| 5 | Error Prevention | 2 | New tab-bar "Leave Sale" path wasn't given the rigor of the path it replaced |
| 6 | Recognition Rather Than Recall | 4 | CommissionModal's derived base-price row is textbook |
| 7 | Flexibility and Efficiency of Use | 3 | Auto-submit OTP + `returnTo=back` threading both preserve task context well |
| 8 | Aesthetic and Minimalist Design | 3 | OK button is present-but-inert most of the time; dashboard can reach 6 tiles |
| 9 | Help Recognize/Diagnose/Recover from Errors | 2 | Good feedback on first failed attempt; zero feedback on a repeat tap |
| 10 | Help and Documentation | 2 | No contextual help for new referral field or commission-floor behavior |
| **Total** | | **27/40** | **Acceptable** |

## Design Specificity Verdict

**Authored for Dukana specifically — high confidence.** The OTP field is a from-scratch geometric animation system, not a lifted library component. Copy is domain-fluent throughout ("Shop's base price," "till," KES formatting, M-Pesa STK vocabulary). The referral feature deliberately differentiates owner (subscription credit) vs. staff (cash payout) mechanics and carries that distinction faithfully from service layer into UI copy.

**Deterministic scan**: `detect.mjs` is an HTML/CSS rule engine; a real attempt against `Button.tsx` returned exit 0 with an empty result set, confirming it's semantically inert on RN source (not a crash, just no applicable rules). No browser visualization was possible (no dev-server view of native screens in this environment). In its place, a manual pattern scan found: zero non-Ionicons icon usage, zero hardcoded colors on any *changed* line (some pre-existing hex values elsewhere in touched files were confirmed untouched by this diff), a fully clean `VerifyButton.tsx` deletion with no orphaned references anywhere in the repo, and two duplication patterns worth naming — `app/(staff)/refer.tsx` is a ~190-line near-duplicate of the pre-existing `app/(owner)/refer.tsx` (acknowledged in its own doc comment), and the OTP status-derivation + delayed-navigate logic was independently written twice, nearly identically, in `forgot-password.tsx` and `verify-email.tsx`.

## Overall Impression

This is a genuinely well-crafted batch — strong token discipline, real product knowledge in the comments, and several bug fixes (BottomSheet's keyboard flash, stale product-form drafts) that are correct and well-reasoned. The regressions are concentrated almost entirely in two places: the new `OtpCodeField` OK button and the new tab-bar "Leave Sale" flow — both shared/duplicated primitives, which means each defect reproduces across every screen that uses them (three auth/payment screens; two tab layouts). The single biggest opportunity is fixing those two hot spots, not a broad sweep.

## What's Working

1. **`CommissionModal`/`ProductForm`/`productPayload.ts` — Variable-Price commission floor.** Derives and shows the Min Price as the commission floor read-only instead of asking the owner to retype it, and mirrors the same derivation into the save payload so it can't drift from what the form displayed.
2. **`BottomSheet.tsx`'s keyboard-avoidance rewrite** — independently flagged as a strength by both assessments. Fixes a real first-frame centering flash with a precise, correct inline explanation, touching nothing else.
3. **`NewProductScreen`/`EditProductScreen` stale-draft fixes** — also independently flagged by both assessments. Both screens now correctly reset form state on cancel/save, closing a real "screen outlives a tab switch" bug class.

## Priority Issues

**[P0] Leaving a sale via the tab bar drops 3 of 4 pieces of till state that the back-button path correctly clears.**
- **Where**: `app/(owner)/_layout.tsx:185-204`, `app/(staff)/_layout.tsx:198-217` (new, calls only `clearCart()`) vs. `components/sales/PosScreen.tsx:150-175` (`confirmLeave`, pre-existing, also clears `customerPhone`, `mpesaMode`, `manualReceiptCode`).
- **Why it matters**: those three fields are local state in `PosScreen`, structurally unreachable from the tab bar. Since the Sales/POS tab stays mounted across tab switches, a cashier who leaves via a tab tap can return to a fresh sale with a **previous customer's phone number still pre-filled** in the M-Pesa STK field — a real financial/trust hazard, not cosmetic. The two paths also now show different copy ("Leave Sale?" vs. "Discard Sale?") for the same action.
- **Fix**: Lift `customerPhone`/`mpesaMode`/`manualReceiptCode` into `useCartStore` alongside `cart`, or have the tab-bar handler call one shared `resetSaleState()`. Unify the copy. `PosScreen.tsx:922-924` already resets these three together on payment-method change — reuse that exact reset.
- **Suggested command**: `/impeccable harden`

**[P1] `OtpCodeField`'s "OK" button silently does nothing on a repeat tap after a failed attempt.**
- **Where**: `components/ui/OtpCodeField.tsx:158-162` (`submit` returns early when `code === lastSubmitted.current`, and a failed attempt doesn't clear the code before the next idle render).
- **Why it matters**: reproduces identically across `forgot-password.tsx`, `verify-email.tsx`, and `VerificationModal.tsx` (auth, password reset, and M-Pesa identity verification). A user who retaps OK after a wrong-code error gets zero feedback — no request, no shake, no toast — and will conclude the app is frozen. The only working recovery is editing a digit, which isn't discoverable from the UI. **Independently confirmed by the technical audit** (below) as both a touch-target violation and a platform-conformance issue, and the same duplicated status-derivation logic in both auth screens means a fix needs to land in two places (or be extracted into one shared hook first).
- **Fix**: Re-arm `lastSubmitted` whenever `status` returns to `'idle'` after a non-success state, not just when the code shortens.
- **Suggested command**: `/impeccable harden`

**[P2] Loss of a prominent primary "Verify" CTA, replaced by a sub-44pt button that's almost never actually pressed.**
- **Where**: `components/ui/OtpCodeField.tsx:308-317` (`size="sm"`, no `minHeight`); previously `components/payments/verification/VerifyButton.tsx` (deleted) was a full-width `lg` CTA.
- **Why it matters**: auto-submit already fires the instant the 6th digit lands, so the OK button is live only in a narrow, easy-to-miss window — and per P1, often dead even then. Unverified per the team's own notes ("no on-device QA done yet" on this exact rebuild).
- **Fix**: commit to one model — drop the button and rely on auto-submit, or fix P1 and size it to match the deleted button's prominence for a security-critical action.
- **Suggested command**: `/impeccable clarify`

**[P3] "Refer & Earn" dashboard tile is the only quick-action tile not capability-gated.**
- **Where**: `app/(staff)/dashboard.tsx:107-111` — pushes unconditionally, unlike every sibling tile, and can dead-end into `refer.tsx`'s "not live yet" empty state.
- **Fix**: gate behind the same `enabled` flag `refer.tsx` already fetches.
- **Suggested command**: `/impeccable clarify`

## Persona Red Flags

**Jordan (First-Timer)** — retaps the visible "OK" button after a typo, natural first instinct for someone unfamiliar with auto-submit OTP fields. Nothing happens (P1). No UI signal that the fix is "change a digit." Exactly the silent dead-end this persona is defined to abandon at.

**Sam (Accessibility-Dependent User)** — genuine strength: `AccessibilityInfo.announceForAccessibility` fires correctly on error/verifying/verified, and the hidden input's label stays current with digit count and status — above-average VoiceOver/TalkBack support for a custom input. Red flag: a VoiceOver user who double-taps the dead OK button gets no announcement at all — worse than a sighted user, who can at least see nothing changed. The button's sub-44pt target (confirmed by the audit below) compounds this.

**Casey (Distracted Mobile User)** — gets pulled away mid-sale, taps a different tab, sees "Leave Sale?", taps Leave assuming a full reset. It isn't (P0) — returning later to ring up a different customer can show a stale phone number still sitting in the M-Pesa field. Precisely the "interrupted, returns later" scenario this persona is defined by, handled worse than the pre-existing back-button path.

## Minor Observations

- `register.tsx` prefills `referralCode` from a deep link verbatim (no uppercasing), while manual typing always uppercases via `onChangeText` — a lowercase deep-link code displays lowercase, inconsistent with typing the same code manually.
- `app/(staff)/refer.tsx` duplicates ~190 lines / 15 of 17 style keys from `app/(owner)/refer.tsx` byte-for-byte. Acknowledged in its own doc comment as deliberate, but nothing enforces the two staying in sync on future edits.
- `app/(owner)/settings/_layout.tsx`'s move from `key={pathname}` (full remount) to a `screenListeners`-based `navigation.reset()` is a more-performant fix for the same underlying React Navigation issue — sound reasoning, worth confirming on-device since it touches navigator internals.
