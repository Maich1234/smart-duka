import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { PaymentsSection } from '@/components/payments/PaymentsSection';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SettingsSectionLabel } from '@/components/settings/SettingsRow';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/** M-Pesa Business credentials — the till's own payment-button list lives at /(owner)/payment-methods. */
export default function IntegrationsSettingsScreen() {
  const tabBarHeight = useTabBarHeight();

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.lg }}>
        <SettingsSectionLabel label="Connect the services Dukana talks to on your behalf." />

        <Animated.View entering={FadeInUp.duration(320)} style={styles.wrap}>
          <PaymentsSection />
        </Animated.View>

        <AnimatedPressable
          style={styles.linkRow}
          onPress={() => router.push('/(owner)/payments')}
          accessibilityRole="button"
          accessibilityLabel="View M-Pesa transactions"
        >
          <Ionicons name="receipt-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.linkText}>View M-Pesa transactions</Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
        </AnimatedPressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  wrap: { marginHorizontal: Spacing.lg },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  linkText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
});
