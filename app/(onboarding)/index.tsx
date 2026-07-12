import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { HeroDashboard } from '@/components/onboarding/HeroDashboard';
import { Scene, SceneGradient } from '@/components/onboarding/theme';
import { useOnboardingStore } from '@/store/onboardingStore';
import { haptics } from '@/utils/haptics';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

const PREVIEW_CAPTIONS = [
  'Never lose a sale again.',
  'Know your stock at a glance.',
  'Get paid in seconds — M-PESA built in.',
  'Watch your profits grow.',
  'Run your shop from anywhere.',
];
const PREVIEW_CAPTION_MS = 4000;
const PREVIEW_TOTAL_MS = PREVIEW_CAPTIONS.length * PREVIEW_CAPTION_MS;

export default function OnboardingWelcome() {
  const [previewing, setPreviewing] = useState(false);
  const [captionIndex, setCaptionIndex] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  // "I already have an account" is a clear signal this device isn't new —
  // mark the journey done so cold starts go straight to sign-in from now on.
  // (Owners can replay it later via the store's restart().)
  const skipToLogin = () => {
    haptics.light();
    useOnboardingStore.getState().markCompleted();
    router.replace('/(auth)/login');
  };

  const startPreview = () => {
    haptics.light();
    setPreviewing(true);
    setCaptionIndex(0);
    PREVIEW_CAPTIONS.forEach((_, i) => {
      if (i === 0) return;
      timersRef.current.push(setTimeout(() => setCaptionIndex(i), i * PREVIEW_CAPTION_MS));
    });
    timersRef.current.push(setTimeout(() => setPreviewing(false), PREVIEW_TOTAL_MS));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[...SceneGradient]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <AnimatedPressable
            onPress={skipToLogin}
            style={styles.signInPill}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Sign in to an existing shop"
          >
            <Text style={styles.signIn}>Sign in</Text>
          </AnimatedPressable>
        </View>

        <View style={styles.heroWrap}>
          <HeroDashboard tempo={previewing ? 'live' : 'ambient'} />
          {previewing ? (
            <Animated.Text
              key={captionIndex}
              entering={FadeInUp.duration(350)}
              exiting={FadeOutDown.duration(250)}
              style={styles.previewCaption}
            >
              {PREVIEW_CAPTIONS[captionIndex]}
            </Animated.Text>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <Animated.Text entering={FadeInDown.duration(550).delay(250)} style={styles.headline}>
            Your shop.{'\n'}
            <Text style={styles.headlineAccent}>Smarter.</Text>
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(550).delay(380)} style={styles.sub}>
            Manage stock, sell faster, accept payments and grow your business — all from one
            place.
          </Animated.Text>

          <Animated.View entering={FadeInDown.duration(550).delay(500)}>
            <AnimatedPressable
              onPress={() => {
                haptics.medium();
                router.push('/(onboarding)/demo');
              }}
              style={styles.ctaWrap}
              accessibilityRole="button"
              accessibilityLabel="Start my shop"
            >
              <LinearGradient
                colors={['#14B8A6', '#0F766E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>Start My Shop</Text>
                <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
              </LinearGradient>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={startPreview}
              disabled={previewing}
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel="Watch a 20 second preview"
            >
              <Ionicons
                name={previewing ? 'pause-circle-outline' : 'play-circle-outline'}
                size={17}
                color={Scene.textDim}
              />
              <Text style={styles.secondaryText}>
                {previewing ? 'Previewing your shop live…' : 'Watch 20-second preview'}
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={skipToLogin}
              style={styles.haveAccountRow}
              accessibilityRole="button"
              accessibilityLabel="Sign in to an existing account and skip the tour"
            >
              <Text style={styles.haveAccountText}>Already have an account?</Text>
              <Text style={styles.haveAccountLink}> Sign in</Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Scene.bgFrom },
  safe: { flex: 1, paddingHorizontal: Spacing.lg },
  topBar: { alignItems: 'flex-end', paddingTop: Spacing.sm },
  signInPill: {
    borderWidth: 1,
    borderColor: 'rgba(248,250,252,0.25)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  signIn: {
    color: Scene.text,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  heroWrap: { flex: 1, justifyContent: 'center' },
  previewCaption: {
    color: Scene.glowSoft,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  bottom: { paddingBottom: Spacing.lg },
  headline: {
    color: Scene.text,
    fontSize: 40,
    lineHeight: 46,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: -0.8,
  },
  headlineAccent: { color: Scene.glowSoft },
  sub: {
    color: Scene.textDim,
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    fontFamily: Typography.fontFamily,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    maxWidth: 340,
  },
  ctaWrap: {
    borderRadius: 18,
    shadowColor: Scene.glow,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    paddingVertical: 17,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilySemiBold,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    marginTop: Spacing.xs,
  },
  secondaryText: {
    color: Scene.textDim,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  haveAccountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  haveAccountText: {
    color: Scene.textDim,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
  },
  haveAccountLink: {
    color: Scene.glowSoft,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
