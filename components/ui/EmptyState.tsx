import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
}

/** Outlined box gently bobbing over a shadow that grows as the box dips. */
function EmptyBox() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * 14 }],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + progress.value * 0.25,
    transform: [{ scale: 0.7 + progress.value * 0.3 }],
  }));

  return (
    <View style={styles.animation}>
      <Animated.View style={[styles.box, boxStyle]} />
      <Animated.View style={[styles.boxShadow, shadowStyle]} />
    </View>
  );
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, subtitle }) => {
  return (
    <View style={styles.container}>
      <EmptyBox />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  animation: { width: 120, height: 120 },
  box: {
    position: 'absolute',
    left: 24,
    top: 26,
    width: 72,
    height: 52,
    borderWidth: 4,
    borderColor: Colors.primary,
    borderRadius: 10,
  },
  boxShadow: {
    position: 'absolute',
    left: 30,
    top: 91,
    width: 60,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.textSecondary,
  },
  title: {
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: Typography.size.body,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  subtitle: {
    fontFamily: Typography.fontFamily,
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
