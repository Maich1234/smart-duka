import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarHeightFor } from '@/constants/Layout';

/**
 * How much space the floating tab bar covers at the bottom of the screen.
 *
 * Every screen inside the owner/staff tab navigators must reserve this much
 * room — the bar is absolutely positioned, so nothing else pushes content out
 * from under it. Prefer this over `useBottomTabBarHeight()` from
 * expo-router/js-tabs: a custom `tabBar` never reports its layout back to the
 * navigator, so that hook returns a stale UIKit default (see constants/Layout).
 *
 * Tracks the system font scale because the bar does: the label is the one part
 * of it that grows, and a screen that reserved only the default height would
 * have its last row covered once a user turned text size up — the setting the
 * owners this app is built for are most likely to have raised.
 */
export const useTabBarHeight = (): number => {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return tabBarHeightFor(fontScale) + insets.bottom;
};
