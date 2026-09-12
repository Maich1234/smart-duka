import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  type LayoutChangeEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';

/**
 * A horizontally scrolling tab rail with an underline that slides between
 * tabs rather than disappearing and reappearing under the new one.
 *
 * Why a rail instead of equal-width columns: a fixed N-column strip has to
 * make every label fit the narrowest phone, so it clips the moment the system
 * font size goes up — which is the setting the owners PRODUCT.md describes
 * are most likely to have raised. Tabs here take the width their own label
 * needs and the strip scrolls, so a longer word, a longer translation, or a
 * larger font costs scroll distance instead of legibility. When they all fit
 * (a tablet, a short set) `flexGrow` spreads them across the full width, so
 * the rail never looks stranded at the left edge.
 *
 * The underline's position and width are interpolated from measured tab
 * geometry, so it tracks a half-finished swipe between two tabs of different
 * widths — not just the settled index.
 */

export interface ScrollableTab {
  key: string;
  label: string;
  /** Optional, but PRODUCT.md's low-literacy commitment makes it close to required. */
  icon?: keyof typeof Ionicons.glyphMap;
}

interface ScrollableTabBarProps {
  tabs: ScrollableTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /**
   * Live position in tab units — 1.5 means halfway between the second and
   * third tab. Pass the pager's own scroll position and the underline tracks
   * the finger through a swipe. Omit it and the bar springs to `activeIndex`
   * on its own.
   */
  progress?: SharedValue<number>;
  accessibilityLabel?: string;
}

/** How far the underline is inset from each edge of its tab. */
const INDICATOR_INSET = 12;

type TabLayout = { x: number; width: number };

/** Stable identity so it can sit in dependency arrays without re-triggering. */
const NO_LAYOUTS: (TabLayout | undefined)[] = [];

export const ScrollableTabBar: React.FC<ScrollableTabBarProps> = ({
  tabs,
  activeIndex,
  onSelect,
  progress,
  accessibilityLabel = 'Sections',
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  // Used only when the caller has no pager position to hand over.
  const ownProgress = useSharedValue(activeIndex);
  const position = progress ?? ownProgress;

  useEffect(() => {
    if (progress) return;
    ownProgress.value = withSpring(activeIndex, Motion.spring.enter);
  }, [activeIndex, progress, ownProgress]);

  // Measured geometry, mirrored into shared values so the underline can be
  // interpolated on the UI thread without a JS round trip per frame.
  const xs = useSharedValue<number[]>([]);
  const widths = useSharedValue<number[]>([]);

  // Measurements are stored with the tab set they were taken for. Geometry
  // from a previous set would put the underline over the wrong tab, and
  // discarding it by reading through the key costs no extra render — clearing
  // it from an effect would.
  const tabsKey = useMemo(() => tabs.map((t) => t.key).join('|'), [tabs]);
  const [measurement, setMeasurement] = useState<{ key: string; layouts: (TabLayout | undefined)[] }>(
    () => ({ key: tabsKey, layouts: NO_LAYOUTS }),
  );
  const layouts = measurement.key === tabsKey ? measurement.layouts : NO_LAYOUTS;

  const measured =
    tabs.length > 0 && layouts.length === tabs.length && layouts.every(Boolean);

  useEffect(() => {
    if (!measured) return;
    xs.value = layouts.map((l) => l!.x + INDICATOR_INSET);
    widths.value = layouts.map((l) => Math.max(l!.width - INDICATOR_INSET * 2, 8));
  }, [measured, layouts, xs, widths]);

  const onTabLayout = useCallback(
    (index: number) => (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      setMeasurement((prev) => {
        const base = prev.key === tabsKey ? prev.layouts : NO_LAYOUTS;
        const current = base[index];
        if (prev.key === tabsKey && current && current.x === x && current.width === width) return prev;
        const next = [...base];
        next[index] = { x, width };
        return { key: tabsKey, layouts: next };
      });
    },
    [tabsKey],
  );

  // Keep the selected tab on screen — centred where there is room to centre
  // it, and flush against whichever end it is nearest otherwise.
  useEffect(() => {
    const layout = layouts[activeIndex];
    if (!layout || viewportWidth === 0) return;
    const maxScroll = Math.max(0, contentWidth - viewportWidth);
    const centred = layout.x + layout.width / 2 - viewportWidth / 2;
    scrollRef.current?.scrollTo({
      x: Math.min(Math.max(centred, 0), maxScroll),
      animated: true,
    });
  }, [activeIndex, layouts, viewportWidth, contentWidth]);

  const indicatorStyle = useAnimatedStyle(() => {
    const x = xs.value;
    const w = widths.value;
    // Hidden until measured, so it never flashes at the left edge on mount.
    if (x.length === 0) return { opacity: 0, width: 0, transform: [{ translateX: 0 }] };
    if (x.length === 1) return { opacity: 1, width: w[0], transform: [{ translateX: x[0] }] };
    const input = x.map((_, i) => i);
    return {
      opacity: 1,
      width: interpolate(position.value, input, w, Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(position.value, input, x, Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View style={s.bar}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.content}
        decelerationRate="fast"
        onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
      >
        {tabs.map((tab, i) => {
          const isActive = i === activeIndex;
          return (
            // The wrapper carries onLayout because the pressable is
            // pressto-backed and takes no layout callback; measuring the
            // wrapper also keeps the geometry free of the press-scale
            // transform applied to its child.
            <View key={tab.key} onLayout={onTabLayout(i)} style={s.tabWrap}>
            <AnimatedPressable
              onPress={() => { if (!isActive) { haptics.light(); onSelect(i); } }}
              style={s.tab}
              // Deliberately "button", not "tab": RNGH-backed pressables never
              // fire on web under the roles its accessibility layer treats as
              // inputs, and a tab the owner cannot press is worse than a
              // slightly generic role.
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              {!!tab.icon && (
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={isActive ? Colors.primary : Colors.textSecondary}
                />
              )}
              <Text style={[s.label, isActive && s.labelActive]}>{tab.label}</Text>
            </AnimatedPressable>
            </View>
          );
        })}

        <Animated.View style={[s.indicator, indicatorStyle]} pointerEvents="none" />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  bar: {
    // Opaque: this band pins at the top while the header scrolls under it.
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  content: {
    // Fills the width when the tabs are narrow enough to fit, so the rail
    // isn't stranded at the left on a wide screen; ignored once they overflow.
    minWidth: '100%',
    paddingHorizontal: Spacing.sm,
  },
  tabWrap: { flexGrow: 1 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    // 48dp of target height — PRODUCT.md's dexterity commitment, not a
    // decorative minimum.
    minHeight: 48,
  },
  label: {
    fontSize: 13,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  labelActive: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.primary,
  },
});
