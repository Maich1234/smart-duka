import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import type { ReportPeriod } from '@/services/reports';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
];

interface Props {
  value: ReportPeriod;
  onChange: (v: ReportPeriod) => void;
}

export const PeriodSegmentControl: React.FC<Props> = ({ value, onChange }) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = PERIODS.findIndex((p) => p.value === value);
  const pillX = useSharedValue(0);

  useEffect(() => {
    if (containerWidth > 0) {
      const segW = (containerWidth - 8) / PERIODS.length;
      pillX.value = withSpring(activeIndex * segW, {
        damping: 22,
        stiffness: 280,
        overshootClamping: false,
      });
    }
  }, [activeIndex, containerWidth]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== containerWidth) setContainerWidth(w);
  };

  const segWidth = containerWidth > 0 ? (containerWidth - 8) / PERIODS.length : 0;

  return (
    <View style={styles.track} onLayout={onLayout}>
      {containerWidth > 0 && (
        <Animated.View style={[styles.pill, { width: segWidth }, pillStyle]} />
      )}
      {PERIODS.map((p) => (
        <TouchableOpacity
          key={p.value}
          style={[styles.option, { width: segWidth }]}
          onPress={() => onChange(p.value)}
          activeOpacity={0.8}
        >
          <Text style={[styles.label, value === p.value && styles.labelActive]}>
            {p.label}
          </Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    paddingVertical: 11,
    zIndex: 1,
  },
  label: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  labelActive: {
    color: Colors.white,
  },
});
