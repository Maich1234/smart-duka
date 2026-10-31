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

## Second iteration: attention and figures
- Home price-review warnings now join the operational attention list instead of a separate card. Product counts and potential stock shortfall remain visible, with explicit wording separating exposure from losses already recorded. Full history, definitions and PDF stay on Price checks.
- A healthy price check stays quiet; an unavailable check remains discoverable. Cached price results with a failed refresh say they are the last check.
- Attention items sort by severity. Three appear initially, but all critical items remain visible even if there are more than three. A labelled disclosure reveals remaining alerts. Financial and stock warning text wraps rather than truncating.
- Today's figures render directly without number count-up animation. Gross profit is labelled explicitly; the payment split opens through Payment breakdown. Recent sales show three entries.
- Background dashboard errors explicitly label figures as last saved, while retaining normal navigation and retry through pull-to-refresh.

Validation repeated the 18 browser scenarios and restricted-staff scenario with no runtime errors. Additional direct checks exercised payment disclosure, alert expand/collapse, four simultaneous critical warnings, integrated stale price warning with KES 250 exposure, healthy/loading/error price states through the actual price-attention mapper, and cached-dashboard failure messaging. TypeScript and focused lint passed. These are simulated data/native adapters, not live financial transactions or physical Android checks. No EAS build or update was submitted; changes are batched on the same testing branch.

## Third iteration: Stock and customer discovery
- Stock matches its bottom-tab label and shows an explicit Add product action. Price checks and enabled Purchases are direct labelled destinations. Stock figures use a disclosure; price anomalies stay visible in the attention list.
- Stock filters wrap instead of hiding the last option off-screen. Labels use plain language. Empty filtered results offer Clear filters rather than the first-product prompt.
- Product loading/errors retain the Stock header and tool destinations. Missing product counts are not represented as a verified zero. Cached product refresh failures show a notice.
- Customer directory and customer balances have visible back controls with role-appropriate Home fallbacks, including loading/error/credit-disabled states.
- Customer balance figures wrap into a grid. Overdue amount and overdue customers have distinct labels. Customer status filters wrap, keep labels readable and retain their existing backend filter values. Add customer stays explicit without crowding the header.

Validation: TypeScript, focused lint and diff whitespace checks passed. Direct React Native Web scenarios exercised the actual customer-balance screen, customer directory, Stock screen, inventory header and new tools/filter components with API/native adapters. Twelve balance/tools layouts covered 320/390/768 widths and simulated text scaling of 1 and 1.6, plus three balance states and purchasing disabled. Four customer-directory role/width checks verified Home fallback, restricted staff entries and owner add-sheet access. Twelve Stock scenarios covered loaded/loading/error states at 320/390 widths and 1/1.6 text scales, with Add product/Price checks navigation, retry availability and filter recovery. No runtime errors in the final runs. Physical Android text scaling, native sheets, TalkBack and live API behavior remain to be verified in the batched APK. No EAS build was used.
