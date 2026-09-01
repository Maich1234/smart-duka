import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/**
 * Openers for a blank thread.
 *
 * A chat box with a blinking cursor is the hardest possible first step for
 * someone who has never used an assistant — these show what DuQana can
 * actually answer, in the shopkeeper's own words. Tapping one fills the
 * composer rather than sending it, so the question can be edited (a name, a
 * month) before it goes.
 */
export const SUGGESTED_PROMPTS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'trending-up-outline', text: 'What sold best this week?' },
  { icon: 'time-outline', text: 'When is my shop busiest?' },
  { icon: 'cube-outline', text: 'Which products are running low?' },
  { icon: 'cash-outline', text: 'How much profit did I make this month?' },
  { icon: 'people-outline', text: 'How are my staff doing this month?' },
];

interface SuggestedPromptsProps {
  onSelect: (text: string) => void;
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <View style={s.wrap}>
      <Text style={s.heading}>Try asking</Text>
      {SUGGESTED_PROMPTS.map((prompt) => (
        <AnimatedPressable
          key={prompt.text}
          onPress={() => {
            haptics.selection();
            onSelect(prompt.text);
          }}
          style={s.chip}
          accessibilityRole="button"
          accessibilityLabel={`Ask: ${prompt.text}`}
        >
          <Ionicons name={prompt.icon} size={16} color={Colors.primary} />
          <Text style={s.chipText}>{prompt.text}</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.textTertiary} />
        </AnimatedPressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  heading: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
});
