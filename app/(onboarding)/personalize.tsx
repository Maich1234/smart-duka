import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { JourneyProgress } from '@/components/onboarding/JourneyProgress';
import { ChoiceCard } from '@/components/onboarding/ChoiceCard';
import {
  BUSINESS_TYPES,
  PRODUCT_RANGES,
  PAYMENT_METHODS,
  STRUGGLES,
} from '@/components/onboarding/content';
import { useOnboardingStore } from '@/store/onboardingStore';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const TOTAL_STEPS = 4;

export default function Personalize() {
  const [step, setStep] = useState(0);
  const { answers, setAnswer } = useOnboardingStore();
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goNext = () => {
    haptics.light();
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      router.push('/(onboarding)/preparing');
    }
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
    else router.back();
  };

  // Single-select questions advance on their own after a beat — the selection
  // needs a moment to visually land before the slide.
  const queueAdvance = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(goNext, 420);
  };

  const toggleMulti = (key: 'paymentMethods' | 'struggles', value: string) => {
    const current = answers[key];
    setAnswer(
      key,
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  };

  const questions = [
    {
      title: 'What kind of business do you run?',
      subtitle: 'We’ll shape your shop around it.',
      multi: false,
      body: (
        <View style={styles.listWrap}>
          {BUSINESS_TYPES.map((t) => (
            <ChoiceCard
              key={t.value}
              label={t.label}
              emoji={t.emoji}
              selected={answers.businessType === t.value}
              onPress={() => {
                setAnswer('businessType', t.value);
                queueAdvance();
              }}
            />
          ))}
        </View>
      ),
    },
    {
      title: 'How many products do you manage?',
      subtitle: 'So your inventory feels right from day one.',
      multi: false,
      body: (
        <View style={styles.listWrap}>
          {PRODUCT_RANGES.map((r) => (
            <ChoiceCard
              key={r.value}
              label={r.label}
              subtitle={r.subtitle}
              selected={answers.productRange === r.value}
              onPress={() => {
                setAnswer('productRange', r.value);
                queueAdvance();
              }}
            />
          ))}
        </View>
      ),
    },
    {
      title: 'How do customers usually pay?',
      subtitle: 'Choose all that apply.',
      multi: true,
      selectedCount: answers.paymentMethods.length,
      body: (
        <View style={styles.listWrap}>
          {PAYMENT_METHODS.map((m) => (
            <ChoiceCard
              key={m.value}
              label={m.label}
              emoji={m.emoji}
              multi
              selected={answers.paymentMethods.includes(m.value)}
              onPress={() => toggleMulti('paymentMethods', m.value)}
            />
          ))}
        </View>
      ),
    },
    {
      title: 'What eats your time today?',
      subtitle: 'Pick as many as you like — we’ll fix them together.',
      multi: true,
      selectedCount: answers.struggles.length,
      body: (
        <View style={styles.listWrap}>
          {STRUGGLES.map((s) => (
            <ChoiceCard
              key={s.value}
              label={s.label}
              emoji={s.emoji}
              multi
              selected={answers.struggles.includes(s.value)}
              onPress={() => toggleMulti('struggles', s.value)}
            />
          ))}
        </View>
      ),
    },
  ];

  const q = questions[step];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <JourneyProgress step={step + 1} total={TOTAL_STEPS} onBack={goBack} />

      {/* The keyed container itself stays unanimated: a Reanimated-animated
          ancestor above a ScrollView leaves RNGH pressables inside it
          unresponsive on web — so the enter motion lives on the content. */}
      <View key={step} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.Text entering={FadeInRight.duration(320)} style={styles.title}>
            {q.title}
          </Animated.Text>
          <Animated.Text entering={FadeInRight.duration(320).delay(50)} style={styles.subtitle}>
            {q.subtitle}
          </Animated.Text>
          <Animated.View entering={FadeInRight.duration(320).delay(100)}>{q.body}</Animated.View>
        </ScrollView>

        {q.multi ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.footer}>
            <AnimatedPressable
              onPress={goNext}
              disabled={(q.selectedCount ?? 0) === 0}
              style={[styles.nextBtn, (q.selectedCount ?? 0) === 0 && styles.nextBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.nextBtnText}>
                {(q.selectedCount ?? 0) > 0 ? `Continue (${q.selectedCount})` : 'Select at least one'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </AnimatedPressable>
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  title: {
    fontSize: Typography.size.h1,
    lineHeight: Typography.lineHeight.h1,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 6,
    marginBottom: Spacing.lg,
  },
  listWrap: { gap: Spacing.sm },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
  },
  nextBtnDisabled: { backgroundColor: Colors.textDisabled },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
