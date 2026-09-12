import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { router, type Href } from 'expo-router';
import { openLegal, type LegalDocument } from '@/utils/openLegal';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const DOCUMENTS: { key: LegalDocument; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'terms', label: 'Terms of Service', icon: 'document-text-outline' },
  { key: 'privacy', label: 'Privacy Policy', icon: 'shield-checkmark-outline' },
];

/**
 * Links to the Terms of Service and Privacy Policy from Profile.
 *
 * Google Play requires the privacy policy to be reachable from inside the app,
 * not only from the store listing — and someone who agreed at signup should be
 * able to re-read what they agreed to without hunting for it. There is
 * deliberately no checkbox here: consent was captured once at registration and
 * recorded server-side, and an untick on this screen would have no coherent
 * meaning (it can't retract a signed agreement, and account closure is the
 * actual way out).
 *
 * Account closure is the last row here, and this is the only way to reach it.
 * Play requires deletion to be findable in the app, not that it be one tap
 * from anything — and it used to sit directly beneath "Sign out", where a
 * mis-tap costs an owner their whole business. Legal is where a user looks
 * for it, and it is a section away from the sign-out button.
 */
export const LegalSection: React.FC<{ closeAccountHref: Href }> = ({ closeAccountHref }) => (
  <View style={styles.card}>
    {DOCUMENTS.map((doc, index) => (
      <AnimatedPressable
        key={doc.key}
        onPress={() => openLegal(doc.key)}
        style={[styles.row, index > 0 && styles.rowDivided]}
        accessibilityRole="link"
        accessibilityLabel={`Open ${doc.label}`}
      >
        <Ionicons name={doc.icon} size={18} color={Colors.textSecondary} />
        <Text style={styles.label}>{doc.label}</Text>
        <Ionicons name="open-outline" size={15} color={Colors.textSecondary} />
      </AnimatedPressable>
    ))}

    <AnimatedPressable
      onPress={() => router.push(closeAccountHref)}
      style={[styles.row, styles.rowDivided]}
      accessibilityRole="button"
      accessibilityLabel="Close my account"
    >
      <Ionicons name="person-remove-outline" size={18} color={Colors.textSecondary} />
      <Text style={styles.label}>Close my account</Text>
      <Ionicons name="chevron-forward" size={15} color={Colors.textSecondary} />
    </AnimatedPressable>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 48,
  },
  rowDivided: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  label: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
});
