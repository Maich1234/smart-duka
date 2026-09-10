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
//
// Every millisecond here is spent by a cashier with a customer waiting at the
// counter, so the beat is kept tight and there is no hold on the finished
// frame — navigation fires the moment the footer lands. Tune the whole
// sequence from these five constants; NAVIGATE_AT follows automatically.
const MARK_DURATION = 420;
const WORD_DELAY = 260;
const WORD_DURATION = 380;
const FOOTER_DELAY = WORD_DELAY + WORD_DURATION - 90;
const FOOTER_DURATION = 300;
const NAVIGATE_AT = FOOTER_DELAY + FOOTER_DURATION;

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

  // Navigation is never chained off an animation callback, which would strand
  // the user on this screen if a frame were dropped — it runs off its own
  // timer, and off hydration, both of which always settle.
  const navigated = useRef(false);

  // Started during the first render, not inside the timeout below, so a slow
  // SecureStore/AsyncStorage read overlaps the brand animation instead of
  // being added on top of it. Routing must read the stores after hydration —
  // the initial defaults (no user, onboarding not completed) would otherwise
  // send an already-signed-in device back to the welcome journey.
  const hydration = useRef<Promise<unknown> | null>(null);
  if (!hydration.current) {
    hydration.current = waitForHydration(useAuthStore, useOnboardingStore).catch(() => {});
  }

  useEffect(() => {
    // Settles within ACCESSIBILITY_DEADLINE; scheduling before it resolves
    // would pick the wrong delay for a reduced-motion user.
    if (reduceMotion === null) return;

    let cancelled = false;
    const go = async () => {
      await hydration.current;
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
    };

    // A reduced-motion user is shown no animation, so there is no beat to sit
    // through — send them straight on as soon as the stores are readable.
    const timeout = setTimeout(go, reduceMotion ? 0 : NAVIGATE_AT);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [reduceMotion]);

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
