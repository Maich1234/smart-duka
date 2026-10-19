import React, { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Typography } from '@/constants/Typography';
import { BRAND } from '@/components/brand/DukanaMark';
import { IntroPreview } from '@/components/onboarding/IntroPreview';

const PAGES = [
  { label: 'YOUR EVERYDAY BUSINESS COMPANION', title: 'Your shop.\nAll together.', description: 'Sell and collect payments. Manage stock, customer debts and expenses. Keep your team and your money in view.', note: 'Cash or M-PESA. Connect your business to enable payment prompts.' },
  { label: 'STAY IN CONTROL', title: 'Every item.\nAccounted for.', description: 'Track stock as you sell, record purchases and see what needs restocking.', note: 'Keep selling offline. Pending sales sync when you reconnect.' },
  { label: 'SEE THE BIGGER PICTURE', title: 'Know your shop.\nPlan your next move.', description: 'Follow sales, expenses and profit. Give your team the access they need to do their work.', note: 'One clear view of your business, from the counter to the day’s close.' },
] as const;

export default function OnboardingWelcome() {
  const [page, setPage] = useState(0);
  const reduceMotion = useReducedMotion();
  const scroll = useRef<ScrollView>(null);
  const current = PAGES[page];
  const changePage = (index: number) => {
    setPage(index);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const signIn = () => {
    useOnboardingStore.getState().markCompleted();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.brand} accessible accessibilityLabel="DuQana">
            <Image source={require('@/assets/images/brand-symbol.png')} style={styles.symbol} />
            <Text style={styles.wordmark}>DuQana</Text>
          </View>
          <Pressable onPress={signIn} accessibilityRole="button" style={styles.signIn}>
            <Text style={styles.signInText}>Sign in</Text>
          </Pressable>
        </View>
        <ScrollView ref={scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View key={page} entering={reduceMotion ? undefined : FadeIn.duration(220)}>
            <IntroPreview page={page} />
            <View accessibilityLiveRegion="polite">
              <Text style={styles.eyebrow}>{current.label}</Text>
              <Text accessibilityRole="header" style={styles.title}>{current.title}</Text>
              <Text style={styles.description}>{current.description}</Text>
              <Text style={styles.note}>{current.note}</Text>
            </View>
          </Animated.View>
        </ScrollView>
        <View style={styles.footer}>
          <View style={styles.navigation}>
            <View style={styles.dots}>
              {PAGES.map((item, index) => (
                <Pressable key={item.label} onPress={() => changePage(index)} style={styles.dotTarget}
                  accessibilityRole="button" accessibilityState={{ selected: page === index }}
                  accessibilityLabel={`Introduction ${index + 1} of 3: ${item.label.toLowerCase()}`}>
                  <View style={[styles.dot, index === page && styles.activeDot]} />
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => page < 2 ? changePage(page + 1) : router.push('/(onboarding)/demo')}
              accessibilityRole="button" style={styles.next}>
              <Text style={styles.nextText}>{page < 2 ? 'Next' : 'Try a demo sale'}</Text>
              <Ionicons name="arrow-forward" color="#D7EAE2" size={18} />
            </Pressable>
          </View>
          <Pressable onPress={() => router.push('/(onboarding)/personalize')} accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Set up my shop</Text>
            <Ionicons name="arrow-forward" size={20} color={BRAND.green} />
          </Pressable>
          <Pressable onPress={() => router.push('/(onboarding)/demo')} accessibilityRole="button" style={styles.demo}>
            <Text style={styles.demoText}>Explore a demo · No account needed</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.green },
  shell: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  symbol: { width: 40, height: 40 },
  wordmark: { color: '#FFFFFF', fontFamily: Typography.fontFamilyLogo, fontSize: 25 },
  signIn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  signInText: { color: '#FFFFFF', fontFamily: Typography.fontFamilySemiBold, fontSize: 14 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20 },
  eyebrow: { color: '#E8C681', fontFamily: Typography.fontFamilySemiBold, fontSize: 11, letterSpacing: 1.6, marginTop: 28 },
  title: { color: '#FFFFFF', fontFamily: Typography.fontFamilyBold, fontSize: 36, lineHeight: 43, letterSpacing: -1, marginTop: 12 },
  description: { color: '#E0EDE7', fontFamily: Typography.fontFamily, fontSize: 16, lineHeight: 25, marginTop: 14 },
  note: { color: '#BDD3C9', fontFamily: Typography.fontFamily, fontSize: 12, lineHeight: 19, marginTop: 12 },
  footer: { paddingHorizontal: 24, paddingBottom: 6, borderTopWidth: 1, borderTopColor: '#246552' },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  dots: { flexDirection: 'row' },
  dotTarget: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#80A497' },
  activeDot: { width: 22, backgroundColor: '#E8C681' },
  next: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  nextText: { color: '#D7EAE2', fontSize: 14, fontFamily: Typography.fontFamilySemiBold },
  primary: { minHeight: 56, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: '#F2D393' },
  pressed: { opacity: 0.85 },
  primaryText: { color: BRAND.green, fontFamily: Typography.fontFamilySemiBold, fontSize: 16 },
  demo: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  demoText: { color: '#D7EAE2', fontFamily: Typography.fontFamily, fontSize: 12, textAlign: 'center' },
});
