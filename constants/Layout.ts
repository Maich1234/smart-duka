/**
 * Chrome dimensions that both a navigator and the screens underneath it need
 * to agree on.
 *
 * The tab bar is drawn by our own `PremiumTabBar` (see the (owner)/(staff)
 * layouts) and is absolutely positioned so content can blur through it. That
 * means React Navigation never measures it: `useBottomTabBarHeight()` keeps
 * returning its own UIKit default (49 + the *initial* safe-area inset), which
 * is both too short and, on Android gesture navigation, missing the inset
 * entirely — which is why content used to sit flush against the tab bar.
 * `useTabBarHeight()` derives the real number from this constant instead.
 */

/**
 * The tab bar's CEILING above the bottom safe-area inset, not its exact
 * height. PremiumTabBar applies it as `maxHeight` and lets the row size to
 * its own content, so the bar hugs the icons and labels rather than padding
 * them out to a number — and grows with the system font size until it hits
 * this cap. Screens reserve the cap via `useTabBarHeight()`, which is the
 * safe side to be wrong on: a few points of extra clearance, never content
 * hidden under the bar.
 */
export const TAB_BAR_BASE_HEIGHT = 58;

/** Height of the content row in `ScreenHeader`, excluding the top inset. */
export const HEADER_HEIGHT = 52;
