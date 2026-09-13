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
 * `useTabBarHeight()` derives the real number from these constants instead.
 */

/**
 * The tab bar's floor above the bottom safe-area inset.
 *
 * PremiumTabBar applies it as `minHeight`, not `height`. A fixed height was
 * both too much and too little: at the default text size the icon-and-label
 * row comes to about 52, so the bar padded itself out with dead space, and at
 * a raised system font size the row outgrew the number and `overflow: hidden`
 * clipped the labels. A floor keeps the bar from looking cramped without
 * stopping it growing.
 */
export const TAB_BAR_BASE_HEIGHT = 58;

/**
 * The ceiling, applied as `maxHeight`.
 *
 * Only the label grows with the system font — Ionicons take a fixed `size` —
 * so the row gains roughly one label line at the largest accessibility sizes.
 * This leaves room for that and stops an extreme setting turning the tab bar
 * into a third of the screen.
 */
export const TAB_BAR_MAX_HEIGHT = 76;

/**
 * Line height of the tab label at a font scale of 1 — the only part of the
 * row that grows — so a screen can predict how tall the bar has become
 * without measuring it. See `tabBarHeightFor`.
 */
const TAB_LABEL_LINE_HEIGHT = 13;

/**
 * What the bar actually occupies at a given system font scale, excluding the
 * safe-area inset.
 *
 * Screens reserve this rather than the ceiling: reserving the ceiling would
 * leave 18 points of dead space above the bar on every screen at the default
 * text size, and reserving the floor would let the bar cover content once the
 * font grows. Clamped to the same floor and ceiling the bar itself uses, so
 * the two cannot disagree by more than rounding.
 */
export const tabBarHeightFor = (fontScale: number): number =>
  Math.min(
    TAB_BAR_MAX_HEIGHT,
    Math.max(TAB_BAR_BASE_HEIGHT, TAB_BAR_BASE_HEIGHT + (fontScale - 1) * TAB_LABEL_LINE_HEIGHT),
  );

/** Height of the content row in `ScreenHeader`, excluding the top inset. */
export const HEADER_HEIGHT = 52;
