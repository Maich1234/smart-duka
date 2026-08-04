import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_BASE_HEIGHT } from '@/constants/Layout';

/**
 * How much space the floating tab bar covers at the bottom of the screen.
 *
 * Every screen inside the owner/staff tab navigators must reserve this much
 * room — the bar is absolutely positioned, so nothing else pushes content out
 * from under it. Prefer this over `useBottomTabBarHeight()` from
 * expo-router/js-tabs: a custom `tabBar` never reports its layout back to the
 * navigator, so that hook returns a stale UIKit default (see constants/Layout).
 */
export const useTabBarHeight = (): number => {
  const insets = useSafeAreaInsets();
  return TAB_BAR_BASE_HEIGHT + insets.bottom;
};
