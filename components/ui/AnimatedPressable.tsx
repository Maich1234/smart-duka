import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Motion } from '@/constants/Motion';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
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
  style,
  pressScale = Motion.press.scale,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...props
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressableBase
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) scale.value = withTiming(pressScale, { duration: Motion.duration.fast });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: Motion.duration.fast });
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
      {...props}
    >
      {children}
    </AnimatedPressableBase>
  );
};
