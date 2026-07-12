import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInRight, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { JourneyProgress } from '@/components/onboarding/JourneyProgress';
import { requestNotificationPermission } from '@/services/notifications';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

interface PermissionStep {
  key: 'notifications' | 'camera';
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  body: string;
  bullets: { icon: keyof typeof Ionicons.glyphMap; text: string }[];
  cta: string;
  /** Fires the actual system prompt — only after the user has read why. */
  request: () => Promise<boolean>;
}

const STEPS: PermissionStep[] = [
  {
    key: 'notifications',
    icon: 'notifications',
    iconBg: Colors.warningSubtle,
    iconColor: '#B45309',
    title: 'Stay ahead of your shop',
    body: 'Smart Duka watches your business so you don’t have to.',
    bullets: [
      { icon: 'cube-outline', text: 'Know the moment stock runs low' },
      { icon: 'phone-portrait-outline', text: 'See M-PESA payments as they arrive' },
      { icon: 'bar-chart-outline', text: 'Get your daily sales summary' },
    ],
    cta: 'Allow notifications',
    request: requestNotificationPermission,
  },
  {
    key: 'camera',
    icon: 'camera',
    iconBg: Colors.primarySubtle,
    iconColor: Colors.primary,
    title: 'Add products in a snap',
    body: 'Your camera makes setup effortless.',
    bullets: [
      { icon: 'image-outline', text: 'Photograph products for your catalogue' },
      { icon: 'pricetag-outline', text: 'Put your logo on every receipt' },
    ],
    cta: 'Allow camera',
    request: async () => {
      const res = await ImagePicker.requestCameraPermissionsAsync();
      return res.granted;
    },
  },
];

export default function Permissions() {
  const [index, setIndex] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const step = STEPS[index];

  const advance = () => {
    if (index < STEPS.length - 1) setIndex((i) => i + 1);
    else router.push('/(onboarding)/signup');
  };

  const allow = async () => {
    haptics.light();
    setRequesting(true);
    try {
      const granted = await step.request();
      if (granted) haptics.success();
    } finally {
      setRequesting(false);
      advance();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <JourneyProgress step={index + 1} total={STEPS.length} onBack={() => router.back()} />

      {/* No `exiting` on the keyed view — see personalize.tsx. */}
      <Animated.View key={step.key} entering={FadeInRight.duration(320)} style={styles.content}>
        <View style={styles.illustration}>
          <Animated.View
            entering={ZoomIn.springify().damping(13).delay(120)}
            style={[styles.iconCircle, { backgroundColor: step.iconBg }]}
          >
            <Ionicons name={step.icon} size={44} color={step.iconColor} />
          </Animated.View>
        </View>

        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>

        <View style={styles.bullets}>
          {step.bullets.map((b, i) => (
            <Animated.View
              key={b.text}
              entering={FadeInRight.duration(350).delay(200 + i * 90)}
              style={styles.bulletRow}
            >
              <View style={styles.bulletIcon}>
                <Ionicons name={b.icon} size={16} color={Colors.primary} />
              </View>
              <Text style={styles.bulletText}>{b.text}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={styles.footer}>
          <AnimatedPressable
            onPress={allow}
            disabled={requesting}
            style={styles.allowBtn}
            accessibilityRole="button"
            accessibilityLabel={step.cta}
          >
            <Text style={styles.allowBtnText}>{step.cta}</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => {
              haptics.light();
              advance();
            }}
            style={styles.laterBtn}
            accessibilityRole="button"
          >
            <Text style={styles.laterText}>Maybe later</Text>
          </AnimatedPressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  illustration: { alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.lg },
  iconCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  title: {
    fontSize: Typography.size.h1,
    lineHeight: Typography.lineHeight.h1,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: Spacing.lg,
  },
  bullets: { gap: Spacing.sm, flex: 1 },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    ...Shadows.sm,
  },
  bulletIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  footer: { paddingBottom: Spacing.md },
  allowBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  allowBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
  },
  laterBtn: { alignItems: 'center', paddingVertical: 14 },
  laterText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
