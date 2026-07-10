import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Button } from './Button';

interface ErrorStateProps {
  title: string;
  subtitle?: string;
  onRetry?: () => void;
}

// Exclamation mark drawn on a 120-unit canvas, rendered at 100px.
const U = 100 / 120;

/** Exclamation-in-circle that pops in once, then gives a quick head-shake. */
function ErrorMark() {
  const scale = useSharedValue(0);
  const shift = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.15, { duration: 267, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 200 })
    );
    shift.value = withDelay(
      467,
      withSequence(
        withTiming(6 * U, { duration: 133 }),
        withTiming(-6 * U, { duration: 133 }),
        withTiming(0, { duration: 133 })
      )
    );
  }, []);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.animation, markStyle]}>
      <View style={styles.circle} />
      <View style={styles.stem} />
      <View style={styles.dot} />
    </Animated.View>
  );
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title, subtitle, onRetry }) => {
  return (
    <View style={styles.container}>
      <ErrorMark />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {onRetry ? <Button title="Try Again" onPress={onRetry} variant="outline" size="sm" style={styles.button} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  animation: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 80 * U,
    height: 80 * U,
    borderRadius: 40 * U,
    borderWidth: 5 * U,
    borderColor: Colors.error,
  },
  stem: {
    position: 'absolute',
    top: 50 - 22 * U,
    width: 8 * U,
    height: 28 * U,
    borderRadius: 4 * U,
    backgroundColor: Colors.error,
  },
  dot: {
    position: 'absolute',
    top: 50 + 14 * U,
    width: 8 * U,
    height: 8 * U,
    borderRadius: 4 * U,
    backgroundColor: Colors.error,
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
  button: { marginTop: Spacing.md, minWidth: 140 },
});
