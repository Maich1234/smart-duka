import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import type { CustomerFilter } from '@/services/customers';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const FILTERS: { value: CustomerFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

interface CreditFilterTabsProps {
  value: CustomerFilter;
  onChange: (v: CustomerFilter) => void;
}

/**
 * All / Outstanding / Overdue / Paid — the same sliding-pill segmented
 * control PeriodSegmentControl already established for reports, reused here
 * rather than a second visual language for "pick one of a few states".
 */
export const CreditFilterTabs: React.FC<CreditFilterTabsProps> = ({ value, onChange }) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = FILTERS.findIndex((f) => f.value === value);
  const pillX = useSharedValue(0);

  useEffect(() => {
    if (containerWidth > 0) {
      const segW = (containerWidth - 8) / FILTERS.length;
      pillX.value = withSpring(activeIndex * segW, { damping: 22, stiffness: 280, overshootClamping: false });
    }
    // Reanimated shared values: stable identities, declared for honesty.
  }, [activeIndex, containerWidth, pillX]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== containerWidth) setContainerWidth(w);
  };

  const segWidth = containerWidth > 0 ? (containerWidth - 8) / FILTERS.length : 0;

  return (
    <View style={styles.track} onLayout={onLayout} accessibilityRole="tablist">
      {containerWidth > 0 && (
        <Animated.View style={[styles.pill, { width: segWidth }, pillStyle]} />
      )}
      {FILTERS.map((f) => (
        <AnimatedPressable
          key={f.value}
          style={[styles.option, { width: segWidth }]}
          onPress={() => onChange(f.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === f.value }}
          accessibilityLabel={f.label}
        >
          <Text style={[styles.label, value === f.value && styles.labelActive]} numberOfLines={1}>
            {f.label}
          </Text>
        </AnimatedPressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  pill: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
  },
  option: {
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  labelActive: { color: Colors.white },
});
