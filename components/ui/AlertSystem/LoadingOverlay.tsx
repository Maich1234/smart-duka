import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

// ─── Branded spinner (rotating arc) ──────────────────────────────────────────

const SPINNER_SIZE = 52;
const STROKE = 3.5;
const RADIUS = (SPINNER_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Arc covers ~75% of the circle
const DASH_ARRAY = CIRCUMFERENCE * 0.75;
const DASH_OFFSET = CIRCUMFERENCE - DASH_ARRAY;

function BrandSpinner() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Inner pulse
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.spinnerWrap}>
      {/* Outer rotating arc */}
      <Animated.View style={spinStyle}>
        <Svg width={SPINNER_SIZE} height={SPINNER_SIZE}>
          {/* Track */}
          <Circle
            cx={SPINNER_SIZE / 2}
            cy={SPINNER_SIZE / 2}
            r={RADIUS}
            stroke={Colors.primarySubtle}
            strokeWidth={STROKE}
            fill="none"
          />
          {/* Arc */}
          <Circle
            cx={SPINNER_SIZE / 2}
            cy={SPINNER_SIZE / 2}
            r={RADIUS}
            stroke={Colors.primary}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${DASH_ARRAY} ${CIRCUMFERENCE - DASH_ARRAY}`}
            strokeDashoffset={DASH_OFFSET}
            strokeLinecap="round"
            // Start at top
            transform={`rotate(-90 ${SPINNER_SIZE / 2} ${SPINNER_SIZE / 2})`}
          />
        </Svg>
      </Animated.View>

      {/* Center brand dot */}
      <Animated.View style={[styles.centerDot, pulseStyle]} />
    </View>
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 200 });
  }, [visible]);

  const overlayAnim = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible && opacity.value === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, overlayAnim]}>
        <Animated.View style={[styles.card, overlayAnim]}>
          <BrandSpinner />
          <Text style={styles.label}>{message ?? 'Please wait…'}</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
    minWidth: 160,
  },
  spinnerWrap: {
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  label: {
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
