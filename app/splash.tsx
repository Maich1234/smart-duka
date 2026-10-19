import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BRAND } from '@/components/brand/DukanaMark';
import { Typography } from '@/constants/Typography';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { waitForHydration } from '@/utils/hydration';

export default function SplashScreen() {
  const isAuthLoading = useAuthStore(state => state.isLoading);
  useEffect(() => {
    if (isAuthLoading) return;
    let cancelled = false;
    const openApp = async () => {
      await waitForHydration(useAuthStore, useOnboardingStore);
      if (cancelled) return;
      const { user } = useAuthStore.getState();
      router.replace(user
        ? user.role === 'owner' ? '/(owner)/dashboard' : '/(staff)/dashboard'
        : useOnboardingStore.getState().completed ? '/(auth)/login' : '/(onboarding)');
    };
    void openApp();
    return () => { cancelled = true; };
  }, [isAuthLoading]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* The same centred artwork, size and background as the native splash. */}
      <Image source={require('@/assets/images/brand-symbol.png')} style={styles.symbol}
        accessible accessibilityLabel="DuQana is opening" />
      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <Text style={styles.wordmark}>DuQana</Text>
        <Text style={styles.tagline}>Your shop, all together.</Text>
      </SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.green, justifyContent: 'center', alignItems: 'center' },
  symbol: { width: 160, height: 160 },
  footer: { position: 'absolute', bottom: 24, left: 24, right: 24, alignItems: 'center' },
  wordmark: { color: '#FFFFFF', fontFamily: Typography.fontFamilyLogo, fontSize: 32 },
  tagline: { color: '#D7EAE2', fontFamily: Typography.fontFamily, fontSize: 14, marginTop: 10 },
});
