# DuQana first impression

DuQana introduces itself as a shop and business companion: sales, payments,
stock, customer debts, expenses, reporting and staff access. The first screen
states that purpose before asking anyone to register. Three manually selected
panels explain sales, stock and the daily business summary. Sample cards are
labelled; there is no automatic carousel or mandatory timed preview.

People can sign in, set up their shop, or try the existing local demo. The demo
explains its three steps and labels its simulated payments. It never collects
money. Preferences lead to an immediate, scrollable summary; no fake progress
bar claims to enable payment credentials, staff access, or alerts.

## Brand assets

`assets/brand/symbol.svg` is the editable source for the simplified storefront
and receipt symbol. The source retains DuQana's green, white and gold palette.
`scripts/generate-brand-assets.cjs` renders the PNG set using Sharp (install
Sharp in a local development environment before running the script).

- The iOS/legacy icon is an opaque 1024px square without small wordmark text.
- Android foreground and monochrome artwork use a padded 1024px canvas; all
  nontransparent pixels fit inside the central circular safe zone.
- The favicon is an opaque 64px symbol on green for contrast on browser tabs.
- Native and React Native splash surfaces share the same image, 160px image
  width and green background in both system themes.

The launch waits for the existing bounded session validation and persisted
onboarding state. It adds no decorative delay. Font loading errors fall back
instead of leaving the native splash visible indefinitely.

## Release checks

Build a new Android and iOS binary: launcher and native splash configuration
cannot be delivered by an OTA JavaScript update alone. Check the actual release
build (Expo Go does not accurately represent native splash rendering).

Check fresh install, returning signed-out user, owner/staff sessions, offline
launch and rejected sessions. Check round/squircle/themed Android launchers,
iOS home screen, browser favicon, small phones, tablets, enlarged text and
Reduce Motion. In the intro check each panel, pagination, setup, demo and sign-in.
Complete the demo through receipt, then follow personalization, review and
shop setup. The demo makes no network payment call.
