import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { DeleteAccountSection } from './DeleteAccountSection';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/**
 * Account closure, on a screen of its own.
 *
 * It used to sit inline on Profile, immediately below "Sign out" — two rows
 * of the same shape, the same danger colour, one above the other, with the
 * destructive one second. An owner reaching for sign-out and landing a row
 * low starts closing their shop and every staff account with it.
 *
 * Moving it here costs a deliberate tap from the legal block and keeps the
 * real guards (password + typing DELETE + a 14-day window) exactly where
 * they were. Google Play asks that in-app deletion be findable, not that it
 * be adjacent to sign-out.
 *
 * Shared by both role groups so the owner and staff copies cannot drift.
 */
export const CloseAccountScreen: React.FC = () => {
  const tabBarHeight = useTabBarHeight();

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingBottom: tabBarHeight + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.iconWrap}>
        <Ionicons name="person-remove-outline" size={22} color={Colors.danger} />
      </View>

      <Text style={s.title} accessibilityRole="header">Close your account</Text>
      <Text style={s.body}>
        You&apos;ll be asked for your password, and to type DELETE, so this can&apos;t happen by
        accident. Your account then stays open for another 14 days — nothing is removed until that
        date, and one tap cancels it.
      </Text>

      <View style={s.divider} />

      {/* `full` — the trigger and its confirmation sheet. Profile renders the
          same component in `status` mode, which shows the recovery card for a
          closure already filed and nothing otherwise. */}
      <DeleteAccountSection mode="full" />
    </ScrollView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dangerSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginTop: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
});
