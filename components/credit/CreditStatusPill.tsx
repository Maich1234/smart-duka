import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

/**
 * A customer's credit standing, in one word.
 *
 * Deliberately the same four states the backend stores, and the same words the
 * filter chips use, so a row's label and the filter that produced it can never
 * read as different things.
 *
 * Colour alone never carries the meaning — the word does. A shop owner reading
 * this in daylight on a cheap screen, or a person who doesn't separate red from
 * green, gets the same answer either way.
 */
export type CreditStatus = 'none' | 'current' | 'overdue' | 'paid';

const TONES: Record<CreditStatus, { label: string; fg: string; bg: string }> = {
  // The two that matter at a glance.
  overdue: { label: 'Overdue', fg: Colors.danger, bg: Colors.dangerSubtle },
  current: { label: 'Owing', fg: Colors.warningDark, bg: Colors.warningSubtle },
  // Settled, and never borrowed, are different facts — an owner reads them
  // differently when deciding who to trust.
  paid: { label: 'Paid up', fg: Colors.success, bg: Colors.successSubtle },
  none: { label: 'No credit', fg: Colors.textSecondary, bg: Colors.divider },
};

interface CreditStatusPillProps {
  status: CreditStatus;
  /** Appended for an overdue account: "Overdue · 4 days". */
  daysOverdue?: number;
  /** Replaces the standard label, e.g. "Blocked". */
  label?: string;
}

export const CreditStatusPill: React.FC<CreditStatusPillProps> = ({ status, daysOverdue, label }) => {
  const tone = TONES[status] ?? TONES.none;
  const text = label
    ?? (status === 'overdue' && daysOverdue && daysOverdue > 0
      ? `${tone.label} · ${daysOverdue}d`
      : tone.label);

  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.3,
  },
});
