import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';

interface JourneyProgressProps {
  /** 1-based current step. */
  step: number;
  total: number;
  onBack?: () => void;
  /** Right-aligned slot (e.g. a Skip link). */
  right?: React.ReactNode;
}

/**
 * Slim header for journey screens — back chevron, a spring-animated progress
 * track, and an optional trailing action. The fill eases forward (and back)
 * as the user moves through steps.
 */
export const JourneyProgress: React.FC<JourneyProgressProps> = ({ step, total, onBack, right }) => {
  const progress = useSharedValue(step / total);

  useEffect(() => {
    progress.value = withSpring(step / total, Motion.spring.enter);
  }, [step, total]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(1, Math.max(0, progress.value)) * 100}%`,
  }));

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? (
          <AnimatedPressable
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
          </AnimatedPressable>
        ) : null}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  side: { width: 56, alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
});
