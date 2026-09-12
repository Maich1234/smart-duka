import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { haptics } from '@/utils/haptics';
import type { TabDescriptor } from './CollapsibleTabs.types';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

interface BusinessTabBarProps {
  tabs: TabDescriptor[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /**
   * Live position in tab units — 1.5 means halfway between the second and
   * third tab. On native this is written from the pager's own scroll callback
   * so the underline tracks the finger through a swipe; on web it is sprung
   * to the selected index. Either way the underline reads from the UI thread.
   */
  progress: SharedValue<number>;
}

/**
 * The shell's tab strip. Icons as well as labels, because PRODUCT.md commits
 * to designing for low literacy — a row of five words is a worse signpost
 * than five words with five distinct shapes.
 */
export const BusinessTabBar: React.FC<BusinessTabBarProps> = ({ tabs, activeIndex, onSelect, progress }) => {
  const [width, setWidth] = useState(0);
  const tabWidth = tabs.length > 0 ? width / tabs.length : 0;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setWidth((prev) => (prev === next ? prev : next));
  }, []);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * tabWidth }],
  }));

  return (
    <View style={s.bar} onLayout={onLayout} accessibilityRole="tablist">
      {tabWidth > 0 && (
        <Animated.View
          style={[s.indicatorTrack, { width: tabWidth }, indicatorStyle]}
          pointerEvents="none"
        >
          <View style={s.indicator} />
        </Animated.View>
      )}

      {tabs.map((tab, i) => {
        const isActive = i === activeIndex;
        return (
          <AnimatedPressable
            key={tab.key}
            onPress={() => { if (!isActive) { haptics.light(); onSelect(i); } }}
            style={s.item}
            // Deliberately "button", not "tab": RNGH-backed pressables never
            // fire on web under the roles its accessibility layer treats as
            // inputs, and a tab the owner cannot press is worse than a
            // slightly generic role.
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Ionicons name={tab.icon} size={17} color={isActive ? Colors.primary : Colors.textSecondary} />
            <Text style={[s.label, isActive && s.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
};

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    // Opaque: the header scrolls underneath this band once it pins.
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    // 52dp of target — PRODUCT.md's dexterity commitment, not a decorative
    // minimum.
    minHeight: 52,
    paddingTop: 8,
    paddingBottom: 8,
  },
  indicatorTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    alignItems: 'center',
  },
  indicator: {
    height: 2,
    width: '55%',
    borderRadius: 1,
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    // An inactive tab is still a signpost: textTertiary measures 2.56:1 and
    // would make four of the five labels unreadable to the owners PRODUCT.md
    // names.
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  labelActive: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
});
