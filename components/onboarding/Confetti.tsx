import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const PALETTE = ['#2DD4BF', '#5EEAD4', '#E0AC4C', '#F8FAFC', '#F472B6', '#60A5FA'];

interface PieceSpec {
  x: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  color: string;
  w: number;
  h: number;
}

const makePieces = (count: number): PieceSpec[] =>
  Array.from({ length: count }, () => ({
    x: Math.random() * SCREEN_W,
    delay: Math.random() * 600,
    duration: 2200 + Math.random() * 1400,
    drift: (Math.random() - 0.5) * 140,
    spin: (Math.random() < 0.5 ? -1 : 1) * (540 + Math.random() * 540),
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    w: 6 + Math.random() * 5,
    h: 10 + Math.random() * 7,
  }));

const Piece: React.FC<{ spec: PieceSpec }> = ({ spec }) => {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      spec.delay,
      withTiming(1, { duration: spec.duration, easing: Easing.in(Easing.quad) })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.85 ? 1 : 1 - (t.value - 0.85) / 0.15,
    transform: [
      { translateX: spec.x + spec.drift * t.value },
      { translateY: -40 + (SCREEN_H + 80) * t.value },
      { rotate: `${spec.spin * t.value}deg` },
      { rotateX: `${spec.spin * 1.4 * t.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        { width: spec.w, height: spec.h, backgroundColor: spec.color, borderRadius: spec.w / 3 },
        style,
      ]}
    />
  );
};

/** One-shot celebration burst — pieces rain from the top edge and fade out.
 *  Purely decorative; never intercepts touches. */
export const Confetti: React.FC<{ count?: number }> = ({ count = 44 }) => {
  const pieces = useMemo(() => makePieces(count), [count]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((spec, i) => (
        <Piece key={i} spec={spec} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, left: 0 },
});
