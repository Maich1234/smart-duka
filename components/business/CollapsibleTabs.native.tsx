import React, { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useSharedValue, useEvent } from 'react-native-reanimated';
import {
  CollapsibleTabView,
  TabScrollView,
  type Route,
} from 'react-native-collapsible-tabs-native';
import { BusinessTabBar } from './BusinessTabBar';
import type { CollapsibleTabsProps } from './CollapsibleTabs.types';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

/**
 * The tab shell on iOS and Android: a collapsing header over a pinned tab bar
 * and a native pager, from react-native-collapsible-tabs-native.
 *
 * Why the native shell rather than a Reanimated one: a JS implementation moves
 * the list from the native scroll view but the header from a worklet fed by
 * that scroll's *event* — two update paths, so the header trails the list by
 * at least a frame and a gap opens under the tab bar on a fast fling. Here the
 * header is translated inside the same native callback that moved the content,
 * so they cannot diverge no matter how busy the JS thread is. That matters on
 * the budget Android hardware PRODUCT.md targets, where the JS thread is
 * exactly what gives out first.
 *
 * This is a Fabric-only native module, so it needs a fresh native build —
 * `npx expo prebuild` then a new dev/EAS build. It has no web implementation
 * either, which is why this file is `.native.tsx`: Metro resolves the sibling
 * `CollapsibleTabs.tsx` on web, and the module is never pulled into that
 * bundle. Same split the codebase already uses for DatePicker and the
 * Bluetooth printer.
 */
export const CollapsibleTabs: React.FC<CollapsibleTabsProps> = ({
  header,
  tabs,
  activeKey,
  onChange,
  bottomInset,
  refreshing = false,
  onRefresh,
}) => {
  const routes = useMemo<Route[]>(
    () => tabs.map((t) => ({ key: t.key, title: t.label })),
    [tabs],
  );

  // An unknown key would index the pager at -1; fall back to the first tab.
  const index = Math.max(0, tabs.findIndex((t) => t.key === activeKey));

  // Live pager position, written from the native scroll callback and read by
  // the tab bar's indicator on the UI thread — the underline tracks the finger
  // through a swipe without a single per-frame JS call.
  const progress = useSharedValue(index);
  const onPageScroll = useEvent<{ position: number; offset: number }>(
    (event) => {
      'worklet';
      progress.value = event.position + event.offset;
    },
    ['topPageScroll', 'onPageScroll'],
  );

  const handleIndexChange = useCallback(
    (next: number) => {
      const tab = tabs[next];
      if (tab) onChange(tab.key);
    },
    [tabs, onChange],
  );

  const contentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: Spacing.lg,
      paddingBottom: bottomInset + Spacing.xl,
    }),
    [bottomInset],
  );

  // The bands overlay the pager rather than stacking above it, so a page must
  // clear their height itself — TabScrollView adds that padding from the
  // height the shell reports.
  const renderScene = useCallback(
    ({ route }: { route: Route }) => {
      const tab = tabs.find((t) => t.key === route.key);
      return (
        <TabScrollView
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
        >
          {tab?.render()}
        </TabScrollView>
      );
    },
    [tabs, contentContainerStyle],
  );

  const renderHeader = useCallback(() => header, [header]);

  const renderTabBar = useCallback(
    ({ index: current }: { index: number }) => (
      <BusinessTabBar
        tabs={tabs}
        activeIndex={current}
        onSelect={handleIndexChange}
        progress={progress}
      />
    ),
    [tabs, handleIndexChange, progress],
  );

  return (
    <CollapsibleTabView
      style={s.root}
      navigationState={{ index, routes }}
      onIndexChange={handleIndexChange}
      renderHeader={renderHeader}
      renderTabBar={renderTabBar}
      renderScene={renderScene}
      // Always passed, never conditionally: the shell swaps its host component
      // the first time a worklet handler appears, which would remount every
      // page and lose all five scroll positions.
      onPageScroll={onPageScroll}
      refreshing={refreshing}
      onRefresh={onRefresh}
      refreshTintColor={Colors.primary}
      refreshBackgroundColor={Colors.surface}
    />
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
