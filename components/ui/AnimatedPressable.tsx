import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { createAnimatedPressable, type CustomPressableProps } from 'pressto';
import { Motion } from '@/constants/Motion';

type PressMeta = { pressScale?: number };

/**
 * pressto-powered scale pressable — the press animation runs entirely on the
 * UI thread (gesture-driven, spring physics from the root PressablesConfig),
 * so cancelled presses restore smoothly and taps react on the same frame even
 * while JS is busy with API calls.
 */
const ScalePressable = createAnimatedPressable<PressMeta>((progress, { metadata }) => {
  'worklet';
  const target = metadata?.pressScale ?? Motion.press.scale;
  return {
    transform: [{ scale: 1 + (target - 1) * progress }],
  };
});

export interface AnimatedPressableProps
  extends Omit<CustomPressableProps<PressMeta>, 'metadata'> {
  style?: StyleProp<ViewStyle>;
  /** Scale applied on press-in; defaults to a subtle, consistent dip. */
  pressScale?: number;
}

/**
 * Shared tap micro-interaction — a quick scale dip on press-in that springs
 * back on release, instead of every interactive element picking its own
 * opacity/feedback. Disabled elements get no animation.
 */
export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  pressScale = Motion.press.scale,
  ...props
}) => <ScalePressable metadata={{ pressScale }} {...props} />;
