import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Confetti } from '@/components/onboarding/Confetti';
import { Scene, SceneGradient } from '@/components/onboarding/theme';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { updateShopConfig } from '@/services/shop';
import { haptics } from '@/utils/haptics';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

/** Soft halo that keeps breathing behind the checkmark. */
const Halo: React.FC = () => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.12, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 1600, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return <Animated.View style={[styles.halo, style]} />;
};

export default function Celebrate() {
  const user = useAuthStore((s) => s.user);
  const { draft, markCompleted } = useOnboardingStore();
  const queryClient = useQueryClient();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    markCompleted();
    const t = setTimeout(() => {
      haptics.success();
      setShowConfetti(true);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  // Quietly apply what they told us during the journey — currency and
  // location land in the shop config without another form.
  useEffect(() => {
    if (!user || user.role !== 'owner') return;
    const patch: { currency?: string; country?: string; county?: string; subCounty?: string } = {};
    if (draft.currency) patch.currency = draft.currency;
    if (draft.country) patch.country = draft.country;
    if (draft.county) patch.county = draft.county;
    if (draft.subCounty) patch.subCounty = draft.subCounty;
    if (Object.keys(patch).length === 0) return;
    updateShopConfig(patch)
      .then(() => queryClient.invalidateQueries({ queryKey: ['shopConfig'] }))
      .catch(() => {});
  }, [user]);

  // Owners flow into the trial-activation moment ("your shop is ready —
  // let's keep it running"); staff go straight to work — the subscription
  // is owner business.
  const startSelling = () => {
    haptics.medium();
    if (user?.role === 'staff') {
      router.replace('/(staff)/dashboard');
    } else {
      router.replace('/(onboarding)/activate');
    }
  };

  const shopName = user?.shop?.name || draft.shopName || 'Your shop';

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
        <View style={styles.center}>
          <View style={styles.checkWrap}>
            <Halo />
            <Animated.View entering={ZoomIn.springify().damping(10).delay(250)} style={styles.checkCircle}>
              <Ionicons name="checkmark" size={56} color={Scene.bgFrom} />
            </Animated.View>
          </View>

          <Animated.Text entering={FadeInUp.duration(500).delay(600)} style={styles.headline}>
            {shopName} is ready.
          </Animated.Text>
          <Animated.Text entering={FadeInUp.duration(500).delay(750)} style={styles.sub}>
            Everything is set up the way you wanted.{'\n'}Let&apos;s make your first sale.
          </Animated.Text>
        </View>

        <Animated.View entering={FadeInUp.duration(500).delay(950)} style={styles.footer}>
          <AnimatedPressable
            onPress={startSelling}
            style={styles.ctaWrap}
            accessibilityRole="button"
            accessibilityLabel={user?.role === 'staff' ? 'Start selling' : 'Continue'}
          >
            <LinearGradient
              colors={['#14B8A6', '#0F766E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>{user?.role === 'staff' ? 'Start Selling' : 'Continue'}</Text>
              <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
            </LinearGradient>
          </AnimatedPressable>
        </Animated.View>
      </SafeAreaView>

      {showConfetti ? <Confetti count={52} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Scene.bgFrom },
  safe: { flex: 1, paddingHorizontal: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  checkWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
  halo: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: Scene.glow,
  },
  checkCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: Scene.glowSoft,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Scene.glow,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  headline: {
    color: Scene.text,
    fontSize: Typography.size.h1,
    lineHeight: Typography.lineHeight.h1,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  sub: {
    color: Scene.textDim,
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  footer: { paddingBottom: Spacing.lg },
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
});
