import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ViewStyle, LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';

interface ShimmerProps {
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Shimmer: React.FC<ShimmerProps> = ({ height, borderRadius = 8, style }) => {
  const [viewWidth, setViewWidth] = useState(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (viewWidth <= 0) return;
    translateX.value = -viewWidth;
    translateX.value = withRepeat(
      withTiming(viewWidth, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(translateX);
  }, [viewWidth, translateX]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== viewWidth) setViewWidth(w);
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View onLayout={onLayout} style={[styles.base, { height, borderRadius }, style]}>
      {viewWidth > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.7)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
});
