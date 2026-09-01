import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BRAND, DukanaMark, DukanaWordmark } from '@/components/brand/DukanaMark';
import { Typography } from '@/constants/Typography';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { waitForHydration } from '@/utils/hydration';

const { height } = Dimensions.get('window');

const FOOTER = 'Powered by Wabunifu Labs';

// Both marks are sized from their own viewBox ratios so neither distorts.
const MARK_H = 132;
const MARK_W = Math.round(MARK_H * (488 / 550));
const WORD_W = 208;
const WORD_H = Math.round(WORD_W * (166 / 814));

// Beat sheet, mirroring the brand animation: the bag settles first, then the
// word wipes in beneath it, then the footer.
const MARK_DURATION = 620;
const WORD_DELAY = 430;
const WORD_DURATION = 560;
const FOOTER_DELAY = WORD_DELAY + WORD_DURATION - 120;
const FOOTER_DURATION = 420;
const HOLD = 420;
const NAVIGATE_AT = FOOTER_DELAY + FOOTER_DURATION + HOLD;

// Longest we will wait on the reduce-motion query before animating anyway.
const ACCESSIBILITY_DEADLINE = 120;

export default function SplashScreen() {
  // Motion here is purely decorative — the navigation timeout below is what
  // advances the app — so honouring "reduce motion" costs nothing functionally.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.88);
  const wordWidth = useSharedValue(0);
  const footerOpacity = useSharedValue(0);
  const footerTranslateY = useSharedValue(10);

  // Resolved before the animation is scheduled, so a reduced-motion user never
  // sees a frame of movement. Raced against a short deadline: the navigation
  // timeout below runs on a fixed schedule from mount, so a slow (or hung)
  // accessibility query must not be able to hold the logo off-screen for the
  // whole splash — after ACCESSIBILITY_DEADLINE we assume motion is fine.
  useEffect(() => {
    let cancelled = false;
    const settle = (enabled: boolean) => {
      if (!cancelled) {
        cancelled = true;
        setReduceMotion(enabled);
      }
    };
    const deadline = setTimeout(() => settle(false), ACCESSIBILITY_DEADLINE);
    AccessibilityInfo.isReduceMotionEnabled()
      .then(settle)
      .catch(() => settle(false));
    return () => {
      cancelled = true;
      clearTimeout(deadline);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return; // still resolving — hold on the first frame

    if (reduceMotion) {
      markOpacity.value = 1;
      markScale.value = 1;
      wordWidth.value = WORD_W;
      footerOpacity.value = 1;
      footerTranslateY.value = 0;
      return;
    }

    markOpacity.value = withTiming(1, { duration: MARK_DURATION, easing: Easing.out(Easing.cubic) });
    markScale.value = withTiming(1, {
      duration: MARK_DURATION,
      easing: Easing.out(Easing.back(1.4)),
    });
    wordWidth.value = withDelay(
      WORD_DELAY,
      withTiming(WORD_W, { duration: WORD_DURATION, easing: Easing.out(Easing.cubic) })
    );
    footerOpacity.value = withDelay(FOOTER_DELAY, withTiming(1, { duration: FOOTER_DURATION }));
    footerTranslateY.value = withDelay(
      FOOTER_DELAY,
      withTiming(0, { duration: FOOTER_DURATION, easing: Easing.out(Easing.cubic) })
    );
    // Shared values have stable identities; listed for honesty.
  }, [reduceMotion, footerOpacity, footerTranslateY, markOpacity, markScale, wordWidth]);

  // Navigation is deliberately independent of the animation: it runs on the
  // same schedule whether or not motion is reduced, and is never chained off an
  // animation callback (which would strand the user if a frame were dropped).
  const navigated = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(async () => {
      // Routing must read the stores at fire time AND after hydration — the
      // initial defaults (no user, onboarding not completed) would otherwise
      // send an already-signed-in device back to the welcome journey whenever
      // SecureStore/AsyncStorage is slow to hydrate.
      await waitForHydration(useAuthStore, useOnboardingStore);
      if (cancelled || navigated.current) return;
      navigated.current = true;
      const { user } = useAuthStore.getState();
      if (user) {
        router.replace(user.role === 'owner' ? '/(owner)/dashboard' : '/(staff)/dashboard');
      } else {
        // Fresh devices get the guided journey exactly once.
        const { completed } = useOnboardingStore.getState();
        router.replace(completed ? '/(auth)/login' : '/(onboarding)');
      }
    }, NAVIGATE_AT);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));

  // The word is revealed by growing a clipping window over a fixed-width
  // wordmark, so the glyphs wipe in left-to-right instead of stretching.
  const wordClipStyle = useAnimatedStyle(() => ({ width: wordWidth.value }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
    transform: [{ translateY: footerTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#05563F', BRAND.green, '#00301F']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(0,0,0,0.35)']}
        style={styles.vignetteBottom}
      />

      {/* One label for the lockup: a screen reader should hear the brand once,
          not "image, image" for the bag and the word separately. */}
      <View
        style={styles.centerContent}
        accessible
        accessibilityRole="image"
        accessibilityLabel="DuQana"
      >
        <Animated.View style={markStyle}>
          <DukanaMark width={MARK_W} height={MARK_H} />
        </Animated.View>

        <View style={styles.wordTrack}>
          <Animated.View style={[styles.wordClip, wordClipStyle]}>
            <DukanaWordmark width={WORD_W} height={WORD_H} />
          </Animated.View>
        </View>
      </View>

      <Animated.View style={[styles.footerWrap, footerStyle]}>
        <Text style={styles.footerText}>{FOOTER}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.green,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Fixed-width, centred track. The clip window inside it grows from this
  // track's left edge; animating the centred box directly would move its left
  // edge every frame and the word would slide in rather than wipe.
  wordTrack: {
    width: WORD_W,
    height: WORD_H,
    marginTop: 26,
  },
  wordClip: {
    height: WORD_H,
    overflow: 'hidden',
    // Keeps the full-width wordmark anchored left while the window is narrow.
    alignItems: 'flex-start',
  },
  footerWrap: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
  },
  footerText: {
    fontFamily: Typography.fontFamily,
    fontSize: Typography.size.small,
    color: 'rgba(248,250,252,0.55)',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.26,
  },
});
