import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ProgressRing } from '@/components/onboarding/ProgressRing';
import { Scene, SceneGradient } from '@/components/onboarding/theme';
import { businessLabel, productRangeLabel } from '@/components/onboarding/content';
import { useOnboardingStore } from '@/store/onboardingStore';
import { haptics } from '@/utils/haptics';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

const ITEM_INTERVAL_MS = 620;

export default function Preparing() {
  const answers = useOnboardingStore((s) => s.answers);
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Echo the quiz answers back as things Smart Duka has "prepared" — the
  // moment the product proves it listened.
  const items = useMemo(() => {
    const list: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
      { icon: 'grid-outline', label: `${businessLabel(answers.businessType)} dashboard prepared` },
      {
        icon: 'cube-outline',
        label: `Inventory sized for ${productRangeLabel(answers.productRange).toLowerCase()} products`,
      },
    ];
    if (answers.paymentMethods.includes('mpesa')) {
      list.push({ icon: 'phone-portrait-outline', label: 'M-PESA payments enabled' });
    } else {
      list.push({ icon: 'cash-outline', label: 'Payment tracking configured' });
    }
    if (answers.struggles.includes('employees')) {
      list.push({ icon: 'people-outline', label: 'Staff roles & permissions ready' });
    }
    if (answers.struggles.includes('stock-loss') || answers.struggles.includes('inventory')) {
      list.push({ icon: 'notifications-outline', label: 'Low-stock alerts switched on' });
    }
    if (answers.struggles.includes('debts')) {
      list.push({ icon: 'book-outline', label: 'Customer debt tracking added' });
    }
    list.push({ icon: 'bar-chart-outline', label: 'Reports customized for you' });
    return list.slice(0, 5);
  }, [answers]);

  useEffect(() => {
    items.forEach((_, i) => {
      timersRef.current.push(
        setTimeout(() => {
          haptics.light();
          setRevealed(i + 1);
        }, 500 + i * ITEM_INTERVAL_MS)
      );
    });
    timersRef.current.push(
      setTimeout(() => {
        haptics.success();
        setDone(true);
      }, 500 + items.length * ITEM_INTERVAL_MS + 500)
    );
    return () => timersRef.current.forEach(clearTimeout);
  }, [items]);

  const progress = done ? 1 : revealed / (items.length + 1);

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
        <Animated.Text entering={FadeInDown.duration(500)} style={styles.kicker}>
          {done ? 'ALL SET' : 'PERFECT'}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(500).delay(120)} style={styles.title}>
          {done
            ? 'Your Smart Duka is ready to build.'
            : `We're preparing Smart Duka for your ${businessLabel(answers.businessType).toLowerCase()}.`}
        </Animated.Text>

        <View style={styles.ringWrap}>
          <ProgressRing
            progress={progress}
            size={132}
            strokeWidth={7}
            color={Scene.glow}
            trackColor="rgba(94,234,212,0.14)"
            duration={ITEM_INTERVAL_MS}
          >
            {done ? (
              <Animated.View entering={ZoomIn.springify().damping(12)}>
                <Ionicons name="checkmark" size={44} color={Scene.glowSoft} />
              </Animated.View>
            ) : (
              <Text style={styles.ringPct}>{Math.round(progress * 100)}%</Text>
            )}
          </ProgressRing>
        </View>

        <View style={styles.list}>
          {items.slice(0, revealed).map((item, i) => (
            <Animated.View key={item.label} entering={FadeInUp.duration(380).springify().damping(16)} style={styles.item}>
              <View style={styles.itemCheck}>
                <Ionicons name="checkmark" size={12} color={Scene.bgFrom} />
              </View>
              <Ionicons name={item.icon} size={16} color={Scene.textDim} />
              <Text style={styles.itemText}>{item.label}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={styles.footer}>
          {done ? (
            <Animated.View entering={FadeInUp.duration(450).springify().damping(16)}>
              <AnimatedPressable
                onPress={() => {
                  haptics.medium();
                  router.push('/(onboarding)/setup');
                }}
                style={styles.ctaWrap}
                accessibilityRole="button"
                accessibilityLabel="Build my shop profile"
              >
                <LinearGradient
                  colors={['#14B8A6', '#0F766E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}
                >
                  <Text style={styles.ctaText}>Build My Shop Profile</Text>
                  <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
                </LinearGradient>
              </AnimatedPressable>
            </Animated.View>
          ) : null}
          <Text style={styles.eta}>
            <Ionicons name="time-outline" size={12} color={Scene.textFaint} /> Ready in under 2
            minutes
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Scene.bgFrom },
  safe: { flex: 1, paddingHorizontal: Spacing.lg },
  kicker: {
    color: Scene.glowSoft,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 3,
    marginTop: Spacing.xl,
  },
  title: {
    color: Scene.text,
    fontSize: Typography.size.h1,
    lineHeight: Typography.lineHeight.h1,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: -0.5,
    marginTop: Spacing.sm,
    maxWidth: 330,
  },
  ringWrap: { alignItems: 'center', marginVertical: Spacing.xl },
  ringPct: {
    color: Scene.text,
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    fontVariant: ['tabular-nums'],
  },
  list: { gap: 10, flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Scene.cardBg,
    borderWidth: 1,
    borderColor: Scene.cardBorderSoft,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
  },
  itemCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Scene.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    color: Scene.text,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
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
  eta: {
    color: Scene.textFaint,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
