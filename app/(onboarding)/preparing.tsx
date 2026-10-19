import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { businessLabel, productRangeLabel } from '@/components/onboarding/content';
import { useOnboardingStore } from '@/store/onboardingStore';
import { BRAND } from '@/components/brand/DukanaMark';
import { Typography } from '@/constants/Typography';

export default function Preparing() {
  const answers = useOnboardingStore(s => s.answers);
  const items = [
    { icon: 'storefront-outline' as const, title: 'Your business', detail: businessLabel(answers.businessType) },
    { icon: 'cube-outline' as const, title: 'Your product range', detail: `${productRangeLabel(answers.productRange)} products` },
    { icon: 'wallet-outline' as const, title: 'Your payments', detail: answers.paymentMethods.includes('mpesa') ? 'Cash and M-PESA tracking. Connect M-PESA after setup to send payment prompts.' : 'Record the payments you receive at the counter.' },
    { icon: 'people-outline' as const, title: 'Your team', detail: 'Invite staff and choose their permissions after creating your shop.' },
  ];
  return <SafeAreaView style={styles.safe}>
    <StatusBar style="light" />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>YOUR SHOP PROFILE</Text>
      <Text accessibilityRole="header" style={styles.title}>A good place to start.</Text>
      <Text style={styles.body}>Here’s what you’ve told us. Next, add your shop details and create your account.</Text>
      <View style={styles.list}>{items.map(item => <View key={item.title} style={styles.item}>
        <Ionicons name={item.icon} size={22} color="#F2D393" />
        <View style={styles.itemBody}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.body}>{item.detail}</Text></View>
      </View>)}</View>
      <Text style={styles.body}>Your shop will be created when you finish registration. You can adjust its settings later.</Text>
    </ScrollView>
    <View style={styles.footer}>
      <Pressable onPress={() => router.push('/(onboarding)/setup')} style={styles.primary} accessibilityRole="button"><Text style={styles.primaryText}>Continue to shop details</Text><Ionicons name="arrow-forward" size={20} color={BRAND.green} /></Pressable>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button"><Text style={styles.backText}>Review my answers</Text></Pressable>
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.green },
  content: { padding: 24, width: '100%', maxWidth: 560, alignSelf: 'center' },
  kicker: { color: '#F2D393', fontSize: 11, letterSpacing: 2, fontFamily: Typography.fontFamilySemiBold, marginTop: 20 },
  title: { color: '#FFFFFF', fontFamily: Typography.fontFamilyBold, fontSize: 32, lineHeight: 40, marginTop: 16 },
  body: { color: '#D7EAE2', fontFamily: Typography.fontFamily, fontSize: 14, lineHeight: 22, marginTop: 8 },
  list: { gap: 12, marginVertical: 28 },
  item: { padding: 16, borderWidth: 1, borderColor: '#397562', borderRadius: 16, flexDirection: 'row', gap: 14 },
  itemBody: { flex: 1 },
  itemTitle: { color: '#FFFFFF', fontFamily: Typography.fontFamilySemiBold, fontSize: 15 },
  footer: { paddingHorizontal: 24, width: '100%', maxWidth: 560, alignSelf: 'center' },
  primary: { backgroundColor: '#F2D393', borderRadius: 16, minHeight: 56, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: BRAND.green, fontFamily: Typography.fontFamilySemiBold, fontSize: 15, flexShrink: 1 },
  back: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  backText: { color: '#D7EAE2', fontFamily: Typography.fontFamily, fontSize: 14 },
});
