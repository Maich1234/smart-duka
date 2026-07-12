import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { PlanCards } from '@/components/subscription/PlanCards';
import { Scene, SceneGradient } from '@/components/onboarding/theme';
import { getPlans, activateTrial, type BillingCycle } from '@/services/subscription';
import { useInvalidateSubscription } from '@/hooks/useSubscription';
import { haptics } from '@/utils/haptics';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

/**
 * "Activate Smart Duka" — the last stop of the onboarding journey. The shop
 * is already set up and celebrated; this screen turns that investment into
 * an activated free trial. Plans, prices, and every line of offer copy come
 * from the backend. Activation never blocks a new shop: any failure still
 * lands them on the dashboard, where the trial banner re-offers.
 */
export default function Activate() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const invalidateSubscription = useInvalidateSubscription();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['subscriptionPlans'],
    queryFn: getPlans,
    staleTime: 60_000,
  });

  const plans = data?.data;

  // Recommended tier is pre-selected until the user picks a card themselves.
  const effectiveSlug = selectedSlug ?? plans?.recommendedPlanSlug ?? null;

  const enterDashboard = () => router.replace('/(owner)/dashboard');

  const startTrial = async () => {
    if (activating) return;
    haptics.medium();
    setActivating(true);
    try {
      await activateTrial({
        planSlug: effectiveSlug ?? undefined,
        billingCycle,
      });
      haptics.success();
    } catch {
      // Never strand a brand-new shop on a pricing screen — the dashboard
      // banner re-offers the trial until it's activated.
    } finally {
      invalidateSubscription();
      enterDashboard();
    }
  };

  const trialDays = plans?.trialDays ?? 30;

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
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.Text entering={FadeInUp.duration(500)} style={styles.headline}>
            Your shop is ready.{'\n'}Let’s keep it running.
          </Animated.Text>

          {isLoading && (
            <View style={styles.loading}>
              <ActivityIndicator color={Scene.glow} size="large" />
            </View>
          )}

          {plans && (
            <Animated.View entering={FadeInUp.duration(500).delay(150)}>
              {/* The earned launch offer */}
              <View style={styles.offerCard}>
                <Text style={styles.offerEmoji}>🎉</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerTitle}>{plans.launchOffer.title}</Text>
                  <Text style={styles.offerHeadline}>{plans.launchOffer.headline}</Text>
                  <Text style={styles.offerNote}>{plans.launchOffer.note}</Text>
                </View>
              </View>

              <PlanCards
                plans={plans.plans}
                staffCount={plans.staffCount}
                currency={plans.currency}
                billingCycle={billingCycle}
                onBillingCycleChange={setBillingCycle}
                selectedSlug={effectiveSlug}
                onSelect={setSelectedSlug}
              />

              <Text style={styles.reassurance}>
                Join free for {trialDays} days today. Your subscription only starts
                after your trial ends, and you can cancel anytime.
              </Text>
            </Animated.View>
          )}

          {isError && (
            <Text style={styles.errorNote}>
              We couldn’t load the plans right now — you can activate your free
              trial later from your dashboard.
            </Text>
          )}
        </ScrollView>

        <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.footer}>
          <AnimatedPressable
            onPress={isError ? enterDashboard : startTrial}
            style={styles.ctaWrap}
            accessibilityRole="button"
            accessibilityLabel={isError ? 'Continue to dashboard' : `Start my free ${trialDays} days`}
          >
            <LinearGradient
              colors={['#14B8A6', '#0F766E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              {activating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.ctaText}>
                    {isError ? 'Continue' : `Start My Free ${trialDays} Days`}
                  </Text>
                  <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
                </>
              )}
            </LinearGradient>
          </AnimatedPressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Scene.bgFrom },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headline: {
    color: Scene.text,
    fontSize: Typography.size.h1,
    lineHeight: Typography.lineHeight.h1,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: -0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  loading: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  offerCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: 'rgba(224,172,76,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(224,172,76,0.35)',
    borderRadius: 18,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  offerEmoji: { fontSize: 26 },
  offerTitle: {
    color: Scene.textDim,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
  },
  offerHeadline: {
    color: Scene.gold,
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    marginVertical: 2,
  },
  offerNote: {
    color: Scene.textDim,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
  },
  reassurance: {
    color: Scene.textFaint,
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  errorNote: {
    color: Scene.textDim,
    fontSize: Typography.size.small,
    lineHeight: Typography.lineHeight.small,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, paddingTop: Spacing.sm },
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
    minHeight: 56,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
