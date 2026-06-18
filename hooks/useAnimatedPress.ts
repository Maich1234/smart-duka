import { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';

export function useAnimatedPress() {
  const scale = useSharedValue(1);

  const onPressIn = () => {
    scale.value = withSpring(0.96);
  };
  const onPressOut = () => {
    scale.value = withSpring(1);
  };
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { onPressIn, onPressOut, animatedStyle };
}