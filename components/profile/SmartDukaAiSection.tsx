import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import type { AiAccessState } from '@/hooks/useAiAccess';

interface SmartDukaAiSectionProps {
  state: AiAccessState;
  aiEnabled: boolean;
  toggling: boolean;
  loadingShop: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * Profile's "Smart Duka AI" section — its own card, separate from the plain
 * PREFERENCES toggles, since this one combines subscription-gated upsell
 * with an owner opt-in/out once subscribed (see hooks/useAiAccess.ts).
 */
export function SmartDukaAiSection({ state, aiEnabled, toggling, loadingShop, onToggle }: SmartDukaAiSectionProps) {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const isSubscribed = state === 'disabled' || state === 'enabled';

  return (
    <View style={s.card}>
      {!isSubscribed ? (
        <AnimatedPressable
          style={s.row}
          onPress={() => router.push('/(owner)/subscription')}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to unlock Smart Duka AI"
        >
          <View style={[s.iconWrap, { backgroundColor: Colors.accentSubtle }]}>
            <Ionicons name="sparkles" size={17} color={Colors.accentDark} />
          </View>
          <View style={s.text}>
            <Text style={s.title}>Smart Duka AI</Text>
            <Text style={s.sub}>Daily insights and a business chat assistant — included with any active subscription</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </AnimatedPressable>
      ) : (
        <>
          <View style={s.row}>
            <View style={[s.iconWrap, { backgroundColor: Colors.accentSubtle }]}>
              <Ionicons name="sparkles" size={17} color={Colors.accentDark} />
            </View>
            <View style={s.text}>
              <Text style={s.title}>Enable Smart Duka AI</Text>
              <Text style={s.sub}>Daily insights and a business chat assistant, powered by Gemini</Text>
            </View>
            <Switch
              value={aiEnabled}
              onValueChange={onToggle}
              disabled={toggling || loadingShop}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={aiEnabled ? Colors.primary : Colors.textTertiary}
            />
          </View>

          <View style={s.divider} />

          <AnimatedPressable
            style={s.row}
            onPress={() => setShowPrivacy(true)}
            accessibilityRole="button"
            accessibilityLabel="What data does Gemini see?"
          >
            <View style={[s.iconWrap, { backgroundColor: Colors.primarySubtle }]}>
              <Ionicons name="shield-checkmark-outline" size={17} color={Colors.primary} />
            </View>
            <View style={s.text}>
              <Text style={s.title}>What data does Gemini see?</Text>
              <Text style={s.sub}>Review what's shared and how it's stored</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </AnimatedPressable>
        </>
      )}

      <BottomSheet visible={showPrivacy} onClose={() => setShowPrivacy(false)}>
        <Text style={p.title}>Smart Duka AI & your data</Text>
        <Text style={p.body}>
          Smart Duka AI (powered by Google Gemini) reads a summary of your shop's sales, inventory, expenses, and aggregated staff performance to answer questions and generate insights. It never sees customer personal data.
          {'\n\n'}
          Conversations are stored securely and linked to your shop so you can revisit them later.
          {'\n\n'}
          Turning this off stops all Gemini processing for your shop immediately.
        </Text>
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.md },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  sub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
});

const p = StyleSheet.create({
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  body: {
    fontSize: Typography.size.small,
    lineHeight: 21,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
});
