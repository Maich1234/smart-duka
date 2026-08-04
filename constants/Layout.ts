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

/** Tab bar height above the bottom safe-area inset. Must match PremiumTabBar. */
export const TAB_BAR_BASE_HEIGHT = 58;

/** Height of the content row in `ScreenHeader`, excluding the top inset. */
export const HEADER_HEIGHT = 52;

/** Minimum tap target, per the platform accessibility guidelines. */
export const HIT_SLOP_SIZE = 44;
