import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, type DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '@/constants/Typography';
import { useAuthStore, type AuthState } from '@/store/authStore';

const { height } = Dimensions.get('window');
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const TITLE = 'Smart Duka';
const FOOTER = 'Powered by Wabunifu Labs';

// Cinematic dark-teal palette, kept within the brand's teal family but deepened for a premium feel.
const SCENE = {
  bgFrom: '#040E0C',
  bgVia: '#091F1A',
  bgTo: '#0E2C25',
  glow: '#2DD4BF',
  glowSoft: '#5EEAD4',
  text: '#F8FAFC',
  footerText: 'rgba(248,250,252,0.55)',
};

// Letters assemble one at a time, alternating up/down like a hand tracing the word — quick and brief.
const WRITE_START_DELAY = 200;
const STAGGER = 55;
const LETTER_DURATION = 260;
const TITLE_SETTLE = WRITE_START_DELAY + (TITLE.length - 1) * STAGGER + LETTER_DURATION;
const FOOTER_DELAY = TITLE_SETTLE + 60;
const FOOTER_DURATION = 420;
const NAVIGATE_AT = FOOTER_DELAY + FOOTER_DURATION + 380;

const NODES = [
  { top: '15%', left: '12%', size: 14, dx: 10, dy: 16, duration: 9000 },
  { top: '20%', left: '80%', size: 9, dx: -12, dy: 10, duration: 11000 },
  { top: '68%', left: '16%', size: 11, dx: 14, dy: -10, duration: 10200 },
  { top: '76%', left: '84%', size: 8, dx: -10, dy: -13, duration: 12500 },
  { top: '42%', left: '6%', size: 6, dx: 8, dy: 11, duration: 8500 },
  { top: '55%', left: '93%', size: 7, dx: -9, dy: 9, duration: 9800 },
] as const;

function FloatingNode({
  top,
  left,
  size,
  dx,
  dy,
  duration,
}: {
  top: DimensionValue;
  left: DimensionValue;
  size: number;
  dx: number;
  dy: number;
  duration: number;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    tx.value = withRepeat(
      withSequence(
        withTiming(dx, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(-dx, { duration, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    ty.value = withRepeat(
      withSequence(
        withTiming(dy, { duration: duration * 1.15, easing: Easing.inOut(Easing.sin) }),
        withTiming(-dy, { duration: duration * 1.15, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    // Fade in, then settle into a slow shimmer. Composed declaratively — chaining the
    // repeat from a withTiming callback recurses infinitely on web when the OS has
    // reduced motion enabled (animations complete synchronously → stack overflow).
    opacity.value = withDelay(
      300,
      withSequence(
        withTiming(1, { duration: 1200 }),
        withRepeat(
          withSequence(
            withTiming(0.35, { duration: duration * 0.8, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.15, { duration: duration * 0.8, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.node,
        { top, left, width: size, height: size, borderRadius: size / 2 },
        animatedStyle,
      ]}
    />
  );
}

function Letter({
  char,
  index,
  glowRadius,
}: {
  char: string;
  index: number;
  glowRadius: SharedValue<number>;
}) {
  const fromBelow = index % 2 === 0;
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(fromBelow ? 12 : -12);
  const rotate = useSharedValue(fromBelow ? -7 : 7);

  useEffect(() => {
    const delay = WRITE_START_DELAY + index * STAGGER;
    const config = { duration: LETTER_DURATION, easing: Easing.out(Easing.cubic) };
    opacity.value = withDelay(delay, withTiming(1, config));
    translateY.value = withDelay(delay, withTiming(0, config));
    rotate.value = withDelay(delay, withTiming(0, config));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
    textShadowRadius: glowRadius.value,
  }));

  return <Animated.Text style={[styles.logoText, style]}>{char}</Animated.Text>;
}

export default function SplashScreen() {
  const user = useAuthStore((s: AuthState) => s.user);
  const [titleWidth, setTitleWidth] = useState(220);

  const bgOpacity = useSharedValue(0);
  const glowRadius = useSharedValue(0);
  const penX = useSharedValue(0);
  const penOpacity = useSharedValue(0);
  const footerOpacity = useSharedValue(0);
  const footerTranslateY = useSharedValue(14);
  const footerBlur = useSharedValue(12);

  useEffect(() => {
    bgOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.ease) });

    // Pen-tip glow traces the baseline at the same pace the letters assemble.
    penOpacity.value = withDelay(
      WRITE_START_DELAY,
      withSequence(
        withTiming(1, { duration: 120 }),
        withDelay(TITLE_SETTLE - WRITE_START_DELAY - 120 - 180, withTiming(0, { duration: 180 }))
      )
    );
    penX.value = withDelay(
      WRITE_START_DELAY,
      withTiming(titleWidth, { duration: TITLE_SETTLE - WRITE_START_DELAY, easing: Easing.linear })
    );

    // One quick glow pulse once the word is fully written — no continuous loop, keeps it brief.
    glowRadius.value = withDelay(
      TITLE_SETTLE,
      withSequence(
        withTiming(14, { duration: 180, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) })
      )
    );

    footerOpacity.value = withDelay(FOOTER_DELAY, withTiming(1, { duration: FOOTER_DURATION }));
    footerTranslateY.value = withDelay(
      FOOTER_DELAY,
      withTiming(0, { duration: FOOTER_DURATION, easing: Easing.out(Easing.cubic) })
    );
    footerBlur.value = withDelay(
      FOOTER_DELAY,
      withTiming(0, { duration: FOOTER_DURATION, easing: Easing.out(Easing.cubic) })
    );

    const timeout = setTimeout(() => {
      if (user) {
        router.replace(user.role === 'owner' ? '/(owner)/dashboard' : '/(staff)/dashboard');
      } else {
        router.replace('/(auth)/login');
      }
    }, NAVIGATE_AT);

    return () => clearTimeout(timeout);
  }, [titleWidth]);

  const backgroundStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));

  const penStyle = useAnimatedStyle(() => ({
    opacity: penOpacity.value,
    transform: [{ translateX: penX.value }],
  }));

  const footerWrapStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
    transform: [{ translateY: footerTranslateY.value }],
  }));

  const footerBlurProps = useAnimatedProps(() => ({
    intensity: footerBlur.value,
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={[SCENE.bgFrom, SCENE.bgVia, SCENE.bgTo]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, backgroundStyle]}>
        <View style={[styles.gridLine, { top: '28%' }]} />
        <View style={[styles.gridLine, { top: '72%' }]} />
        <View style={[styles.gridLineVertical, { left: '22%' }]} />
        <View style={[styles.gridLineVertical, { left: '78%' }]} />

        {NODES.map((node, i) => (
          <FloatingNode key={i} {...node} />
        ))}
      </Animated.View>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.4)', 'transparent']}
        style={styles.vignetteTop}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(0,0,0,0.45)']}
        style={styles.vignetteBottom}
      />

      <View style={styles.centerContent}>
        <View
          style={styles.titleRow}
          onLayout={(e) => setTitleWidth(e.nativeEvent.layout.width)}
        >
          {TITLE.split('').map((char, i) => (
            <Letter key={i} char={char} index={i} glowRadius={glowRadius} />
          ))}
          <Animated.View style={[styles.penDot, penStyle]} />
        </View>
      </View>

      <Animated.View style={[styles.footerWrap, footerWrapStyle]}>
        <Text style={styles.footerText}>{FOOTER}</Text>
        <AnimatedBlurView
          tint="dark"
          animatedProps={footerBlurProps}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCENE.bgFrom,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    position: 'relative',
  },
  logoText: {
    fontFamily: Typography.fontFamilyBold,
    fontSize: Typography.size.display,
    color: SCENE.text,
    letterSpacing: 1,
    textShadowColor: SCENE.glow,
    textShadowOffset: { width: 0, height: 0 },
  },
  penDot: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: SCENE.glowSoft,
    shadowColor: SCENE.glow,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  footerWrap: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
    borderRadius: 4,
  },
  footerText: {
    fontFamily: Typography.fontFamily,
    fontSize: Typography.size.small,
    color: SCENE.footerText,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  node: {
    position: 'absolute',
    backgroundColor: SCENE.glowSoft,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(94,234,212,0.04)',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(94,234,212,0.035)',
  },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.22,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.26,
  },
});
