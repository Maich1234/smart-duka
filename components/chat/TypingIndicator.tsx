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
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

// Same pulsing-dot technique as components/ui/LoadingState.tsx, restyled as
// an inline "Smart Duka AI is thinking..." bubble instead of a full-page loader.
const PULSE_MS = 233;
const HOLD_MS = 867;
const STAGGER_MS = 200;

function Dot({ delay }: { delay: number }) {
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

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[s.dot, animatedStyle]} />;
}

export function TypingIndicator() {
  return (
    <View style={s.row}>
      <View style={s.bubble}>
        <Dot delay={0} />
        <Dot delay={STAGGER_MS} />
        <Dot delay={STAGGER_MS * 2} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { alignSelf: 'flex-start', marginBottom: Spacing.sm },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textTertiary },
});
