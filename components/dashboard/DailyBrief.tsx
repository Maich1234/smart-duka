import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { buildDailyBrief, type BriefTone } from '@/utils/dailyBrief';
import type { OwnerDashboardData } from '@/services/dashboard';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const TONE_STYLE: Record<BriefTone, { fg: string; bg: string }> = {
  positive: { fg: Colors.success, bg: Colors.successSubtle },
  neutral: { fg: Colors.textSecondary, bg: Colors.divider },
  warning: { fg: '#B45309', bg: Colors.warningSubtle },
};

interface DailyBriefProps {
  data: OwnerDashboardData | undefined;
  /** Where "View Insights" leads; defaults to the AI-powered Insights screen. */
  insightsRoute?: string;
}

/**
 * Daily Smart Brief — the dashboard's narrative layer. Three to four short,
 * locally generated observations that turn the day's numbers into sentences
 * the owner can act on, with one quiet exit to the full Insights screen.
 */
export const DailyBrief: React.FC<DailyBriefProps> = React.memo(({ data, insightsRoute = '/(owner)/insights' }) => {
  const bullets = useMemo(() => buildDailyBrief(data), [data]);

  // Even on a quiet day with nothing to flag, this card is the dashboard's
  // only entry point into the AI-powered Insights screen (the Insights tab
  // itself has no tab-bar icon) — it must never fully disappear.
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.sparkChip}>
            <Ionicons name="sparkles" size={12} color={Colors.accentDark} />
          </View>
          <Text style={styles.title}>{"Today's Brief"}</Text>
        </View>
      </View>

      {bullets.length > 0 ? (
        <View style={styles.bullets}>
          {bullets.map((bullet) => {
            const tone = TONE_STYLE[bullet.tone];
            return (
              <View key={bullet.id} style={styles.bulletRow}>
                <View style={[styles.bulletIcon, { backgroundColor: tone.bg }]}>
                  <Ionicons name={bullet.icon} size={13} color={tone.fg} />
                </View>
                <Text style={styles.bulletText}>{bullet.text}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>Nothing urgent today. See the full AI analysis of your business.</Text>
      )}

      <AnimatedPressable
        onPress={() => {
          haptics.light();
          router.push(insightsRoute as never);
        }}
        style={styles.insightsLink}
        accessibilityRole="button"
        accessibilityLabel="View full business insights"
      >
        <Text style={styles.insightsText}>View Insights</Text>
        <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
      </AnimatedPressable>
    </View>
  );
});

DailyBrief.displayName = 'DailyBrief';

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sparkChip: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: Colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  bullets: {
    gap: 10,
  },
  emptyText: {
    fontSize: Typography.size.small,
    lineHeight: 20,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: Typography.size.small,
    lineHeight: 20,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
    paddingTop: 2,
  },
  insightsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
    minHeight: 40,
  },
  insightsText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
});
