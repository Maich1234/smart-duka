# Payment-method follow-up — 30 October 2026

## Reproduction and changes

The earlier propagation changes were merged into web PR 15 and mobile PR 7. Backend PR 19 remained open when checked; its enabled-method guard is still required for rollout.

Mounted the pre-change production mobile RecordPaymentSheet in a React renderer with synthetic props. Entered 40, selected Bank, then supplied the refreshed owner list containing only Cash. The Bank button disappeared, but pressing Record Payment still submitted paymentMethod=bank. This independently reproduces stale selection inside the repayment sheet, beyond the query propagation issue.

The repayment selection is now derived from the current enabled list. It falls back to an available method, never a phantom Cash method when the list is empty. Both the button and handler reject submission with no valid method, during loading/error, or while already submitting. The parent passes loading/error/retry state and no methods before configuration is available. Empty lists have actionable copy. Web repayment submission also checks current membership before persisting a request key and shows a no-method message.

Mobile POS and quotation final Credit confirmations recheck the current enabled list, module flag and permission. Removing Credit while its confirmation remains open no longer allows that confirmation to submit. This does not alter provider-payment completion/recovery callbacks.

## Manual component walkthroughs

Used a temporary independent script loading the production TSX components and payment resolvers through TypeScript transpilation and React rendering. Native visual primitives, configuration/query responses, service transports and lifecycle boundaries were simulated. No existing test suite, production data, provider payment or physical Android device was used.

- Pre-change mobile repayment: removed Bank still submitted Bank (reproduced).
- Fixed mobile repayment: removed Bank is absent, Cash visibly selected, Record Payment submits Cash with the original amount.
- Empty and Credit-only lists: disabled submit and direct handler invocation cannot record anything.
- Configuration loading/error: submit blocked; error retry callback invoked; restored Bank permits a Bank repayment.
- Web repayment: a removed method supplied from a stale form is refused before a pending key is written. An empty list explains the problem and blocks recording. Valid Cash persists its request; after removal, Retry same repayment preserves that original key and exact payment payload.
- Actual quotation conversion component: opened Credit confirmation, then separately removed Credit, revoked permission and disabled the credit module. Each prevented conversion and closed confirmation. An unchanged enabled/permitted Credit flow still submitted Credit.
- POS uses the same final checks; its full mounted screen, native SQLite/outbox and provider paths were not exercised in this follow-up.

Web TypeScript and production build passed. Mobile full TypeScript and whitespace checks passed. React review checked derived selection rather than corrective effects, existing hook order, accessible errors and disabled/handler guards. No dependencies or lockfiles changed.

## Boundaries

Backend PR 19 must be merged/deployed before considering the server removal guard live. This follow-up opens reviewable web/mobile changes; it does not merge or deploy them, build an APK, or certify every payment path. A refreshed client snapshot cannot provide instantaneous cross-device revocation; the server remains authoritative. Existing saved-repayment keys/payloads are preserved so an uncertain prior payment is not silently turned into a new request. In-flight M-Pesa reconciliation and offline sale policy are unchanged.
