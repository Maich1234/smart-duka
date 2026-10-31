# Mobile Home simplification: first testing branch

## Problem and scope
Daily selling was below several dashboard sections, secondary actions could squeeze into one row, and customers/business tools were difficult to discover inside Profile. This change improves Home for owners and staff before any multi-shop implementation.

## Behavior
- Labelled Menu in Home opens a scrollable modal directory grouped by task. Existing bottom tabs and routes remain available.
- New Sale appears before the daily figures. Staff require record_sale to see it.
- Home shows at most three secondary shortcuts. Remaining actions stay accessible through the directory, preserving purchasing, quotation, commission and reconciliation gates.
- Staff Home identifies the shop, not just the employee.
- Today's Brief is removed from Home; Insights remains directly reachable from Menu. Setup checklist remains below operational information.
- Loading and failed dashboard reads keep the menu and authorised sale entry accessible. Missing figures are described as unavailable rather than displayed as zero.
- Shortcut labels wrap. Drawer offers close button, backdrop dismissal and Android onRequestClose handling, with safe-area spacing and modal accessibility semantics.
- No new dependency, backend, transaction, offline storage or billing changes.

## Validation
TypeScript noEmit passed. Direct browser scenarios exercised real owner/staff dashboard, header, drawer, quick-action, daily-card and recent-activity components through React Native Web, using adapters for native-only motion/icons, API/query/auth and unrelated existing cards. Eighteen scenarios covered widths 320/390/768 and loaded/loading/error states for both roles. Checked main sale placement, horizontal overflow, directory destination navigation, close after navigation and error retry. Restricted staff scenario checked absence of unauthorised sale/customer/purchasing/quotation/commission entries. No browser runtime errors. Reviewed screenshots of Home and directory.

This is not physical Android, live API, screen-reader or user usability validation. Native back handling, TalkBack focus, larger system text and payment/offline continuity should be checked on the APK before release. No APK build was started in this change.

## Next iteration
Test actual shop owners/cashiers without coaching. Measure finding customer balances, receipts, quotations, stock checks and expenses. Then decide whether bottom tabs should change, consolidate attention cards and refine forms. Multi-shop membership/context changes belong in a separate branch.
