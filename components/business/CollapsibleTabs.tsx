import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { BusinessTabBar } from './BusinessTabBar';
import type { CollapsibleTabsProps } from './CollapsibleTabs.types';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';

/**
 * The web fallback for the tab shell.
 *
 * react-native-collapsible-tabs-native is a Fabric native module with no web
 * implementation (its entry point is `codegenNativeComponent`), and this app
 * still produces a static web build — `expo.web.output: "static"`, which is
 * what serves the public receipt page a customer opens from a QR code. Metro
 * resolves `CollapsibleTabs.native.tsx` on iOS/Android and this file on web,
 * so the native module never reaches the web bundle. The same split the
 * codebase already uses for DatePicker, printReceipt and the Bluetooth
 * printer.
 *
 * The collapse here is the platform's own: the header and tab bar are the
 * first two children of each tab's scroll view, with the tab bar pinned by
 * `stickyHeaderIndices`. No measurement, no scroll worklet, and pull-to-
 * refresh keeps working — the header is part of the content rather than
 * floating over it.
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
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === activeKey));

  // Tabs mount on first visit and stay mounted, so a tab's scroll position and
  // any extra pages it has already loaded survive a trip to another tab.
  const [visited, setVisited] = useState<Set<string>>(() => new Set([activeKey]));

  // No pager to track on web, so the indicator springs to the selected tab
  // instead of following a finger.
  const progress = useSharedValue(activeIndex);
  useEffect(() => {
    progress.value = withSpring(activeIndex, Motion.spring.enter);
    // Reanimated shared values have a stable identity; listing `progress`
    // would make the compiler treat this mutation as unsafe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const handleSelect = useCallback(
    (next: number) => {
      const tab = tabs[next];
      if (!tab || tab.key === activeKey) return;
      setVisited((prev) => (prev.has(tab.key) ? prev : new Set(prev).add(tab.key)));
      onChange(tab.key);
    },
    [tabs, activeKey, onChange],
  );

  const tabBar = (
    <BusinessTabBar
      tabs={tabs}
      activeIndex={activeIndex}
      onSelect={handleSelect}
      progress={progress}
    />
  );

  return (
    <View style={s.root}>
      {tabs.map((tab) => {
        if (!visited.has(tab.key)) return null;
        const isActive = tab.key === activeKey;
        return (
          <ScrollView
            key={tab.key}
            style={[s.page, !isActive && s.pageHidden]}
            contentContainerStyle={{ paddingBottom: bottomInset + Spacing.xl }}
            // Index 1 is the tab bar: the header above it scrolls away, the
            // tab bar stops at the top and stays reachable.
            stickyHeaderIndices={[1]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
              ) : undefined
            }
          >
            <View>{header}</View>
            {tabBar}
            <View style={s.body}>{tab.render()}</View>
          </ScrollView>
        );
      })}
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  page: { ...StyleSheet.absoluteFill },
  pageHidden: { display: 'none' },
  body: { paddingHorizontal: Spacing.lg },
});
