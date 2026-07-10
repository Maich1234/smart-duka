import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';

interface LoadingStateProps {
  size?: number;
  fullscreen?: boolean;
}

// Each dot pulses 0.7→1.05→0.7 over ~466ms inside a 1333ms cycle, dots
// staggered a third of a cycle apart.
const PULSE_MS = 233;
const HOLD_MS = 867;
const STAGGER_MS = 433;

function Dot({ diameter, delay }: { diameter: number; delay: number }) {
  const scale = useSharedValue(0.7);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.7, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.7, { duration: HOLD_MS })
        ),
        -1
      )
    );
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        { width: diameter, height: diameter, borderRadius: diameter / 2 },
        styles.dot,
        animatedStyle,
      ]}
    />
  );
}

/**
 * Drop-in replacement for a bare full-page `ActivityIndicator`, used while a
 * screen's primary data is still loading.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ size = 96, fullscreen = true }) => {
  const diameter = (size * 18) / 96;
  const gap = (size * 6) / 96;
  return (
    <View style={fullscreen ? styles.fullscreen : styles.inline}>
      <View style={[styles.dots, { height: size * 0.625, gap }]}>
        <Dot diameter={diameter} delay={0} />
        <Dot diameter={diameter} delay={STAGGER_MS} />
        <Dot diameter={diameter} delay={STAGGER_MS * 2} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inline: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dot: { backgroundColor: Colors.primary },
});
