/**
 * Insights screen sections: health score ring, Gemini narrative, alerts,
 * and trend summary. Each section sources its own styling, matching the
 * convention in components/reports/ReportSections.tsx.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ProgressRing } from '@/components/onboarding/ProgressRing';
import { haptics } from '@/utils/haptics';
import { formatCurrency } from '@/utils/formatters';
import type { BusinessSnapshot, AiInsight } from '@/services/aiInsight';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

function SectionHeader({
  icon,
  title,
  delay = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(320).delay(delay)} style={sh.container}>
      <View style={sh.iconWrap}>
        <Ionicons name={icon} size={15} color={Colors.primary} />
      </View>
      <Text style={sh.title}>{title}</Text>
    </Animated.View>
  );
}

const sh = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, letterSpacing: -0.2 },
});

// ─── HealthScoreCard ──────────────────────────────────────────────────────────

const COMPONENT_LABELS: Record<keyof BusinessSnapshot['health']['components'], string> = {
  revenue: 'Revenue',
  profit: 'Profit',
  inventory: 'Inventory',
  cashFlow: 'Cash Flow',
  staff: 'Staff',
};

const scoreColor = (score: number) =>
  score >= 75 ? Colors.success : score >= 50 ? Colors.warning : Colors.danger;

export function HealthScoreCard({ health }: { health: BusinessSnapshot['health'] }) {
  const color = scoreColor(health.score);
  return (
    <Animated.View entering={FadeInDown.duration(340).delay(40)}>
      <SectionHeader icon="pulse-outline" title="Business Health" />
      <View style={[hs.card, Shadows.sm]}>
        <View style={hs.ringRow}>
          <ProgressRing progress={health.score / 100} size={104} strokeWidth={9} color={color} trackColor={Colors.divider}>
            <Text style={[hs.scoreNum, { color }]}>{health.score}</Text>
          </ProgressRing>
          <View style={hs.components}>
            {(Object.keys(COMPONENT_LABELS) as (keyof typeof COMPONENT_LABELS)[]).map((key) => (
              <View key={key} style={hs.componentRow}>
                <Text style={hs.componentLabel}>{COMPONENT_LABELS[key]}</Text>
                <View style={hs.componentTrack}>
                  <View
                    style={[
                      hs.componentFill,
                      { width: `${Math.max(0, Math.min(100, health.components[key]))}%`, backgroundColor: scoreColor(health.components[key]) },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const hs = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  scoreNum: { fontSize: 30, fontFamily: Typography.fontFamilyBold, letterSpacing: -0.5 },
  components: { flex: 1, gap: 8 },
  componentRow: { gap: 3 },
  componentLabel: { fontSize: 11, fontFamily: Typography.fontFamilySemiBold, color: Colors.textTertiary },
  componentTrack: { height: 5, borderRadius: 3, backgroundColor: Colors.divider, overflow: 'hidden' },
  componentFill: { height: '100%', borderRadius: 3 },
});

// ─── AiNarrativeCard ──────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<AiInsight['priority'], { fg: string; bg: string; label: string }> = {
  high: { fg: Colors.danger, bg: Colors.dangerSubtle, label: 'High priority' },
  medium: { fg: '#B45309', bg: Colors.warningSubtle, label: 'Medium priority' },
  low: { fg: Colors.success, bg: Colors.successSubtle, label: 'Low priority' },
};

export function AiNarrativeCard({ insight, cachedNote }: { insight: AiInsight; cachedNote?: string }) {
  const tone = PRIORITY_STYLE[insight.priority];
  return (
    <Animated.View entering={FadeInDown.duration(340).delay(100)}>
      <SectionHeader icon="sparkles" title="Smart Duka Says" delay={80} />
      <View style={[nc.card, Shadows.sm]}>
        <View style={[nc.priorityChip, { backgroundColor: tone.bg }]}>
          <Text style={[nc.priorityText, { color: tone.fg }]}>{tone.label}</Text>
        </View>
        <Text style={nc.summary}>{insight.summary}</Text>
        {insight.actions.length > 0 && (
          <View style={nc.actions}>
            {insight.actions.map((action, i) => (
              <View key={i} style={nc.actionRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.primary} />
                <Text style={nc.actionText}>{action}</Text>
              </View>
            ))}
          </View>
        )}
        {cachedNote && <Text style={nc.cachedNote}>{cachedNote}</Text>}
      </View>
    </Animated.View>
  );
}

const nc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 10,
  },
  priorityChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  priorityText: { fontSize: 11, fontFamily: Typography.fontFamilySemiBold },
  summary: { fontSize: Typography.size.small, lineHeight: 21, fontFamily: Typography.fontFamily, color: Colors.textPrimary },
  actions: { gap: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actionText: { flex: 1, fontSize: Typography.size.small, lineHeight: 20, fontFamily: Typography.fontFamily, color: Colors.textPrimary },
  cachedNote: { fontSize: 11, fontFamily: Typography.fontFamily, color: Colors.textTertiary, marginTop: 2 },
});

// ─── AlertsList ───────────────────────────────────────────────────────────────

const ALERT_STYLE: Record<BusinessSnapshot['alerts'][number]['severity'], { fg: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  critical: { fg: Colors.danger, bg: Colors.dangerSubtle, icon: 'alert-circle-outline' },
  warning: { fg: '#B45309', bg: Colors.warningSubtle, icon: 'warning-outline' },
  info: { fg: Colors.info, bg: '#DBEAFE', icon: 'information-circle-outline' },
};

export function AlertsList({ alerts }: { alerts: BusinessSnapshot['alerts'] }) {
  if (alerts.length === 0) return null;
  return (
    <Animated.View entering={FadeInDown.duration(340).delay(160)}>
      <SectionHeader icon="notifications-outline" title="Alerts" delay={140} />
      <View style={[al.card, Shadows.sm]}>
        {alerts.map((alert, i) => {
          const tone = ALERT_STYLE[alert.severity];
          return (
            <View key={i} style={[al.row, i < alerts.length - 1 && al.rowBorder]}>
              <View style={[al.iconChip, { backgroundColor: tone.bg }]}>
                <Ionicons name={tone.icon} size={16} color={tone.fg} />
              </View>
              <Text style={al.text}>{alert.message}</Text>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const al = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  iconChip: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontSize: Typography.size.small, lineHeight: 19, fontFamily: Typography.fontFamily, color: Colors.textPrimary },
});

// ─── TrendSummary ─────────────────────────────────────────────────────────────

export function TrendSummary({ trend, currency }: { trend: BusinessSnapshot['trend']; currency?: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(340).delay(220)}>
      <SectionHeader icon="trending-up-outline" title="Trend" delay={200} />
      <View style={[ts.card, Shadows.sm]}>
        {(['week', 'month'] as const).map((range, i) => (
          <View key={range} style={[ts.row, i === 0 && ts.rowBorder]}>
            <Text style={ts.rangeLabel}>{range === 'week' ? 'Last 7 days' : 'Last 30 days'}</Text>
            <View style={ts.figures}>
              <Text style={ts.figure}>{formatCurrency(trend[range].revenue, currency)}</Text>
              <Text style={ts.figureSub}>revenue</Text>
            </View>
            <View style={ts.figures}>
              <Text style={ts.figure}>{formatCurrency(trend[range].profit, currency)}</Text>
              <Text style={ts.figureSub}>profit</Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const ts = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  rangeLabel: { flex: 1, fontSize: 12, fontFamily: Typography.fontFamilySemiBold, color: Colors.textTertiary },
  figures: { alignItems: 'flex-end' },
  figure: { fontSize: 13, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  figureSub: { fontSize: 10, fontFamily: Typography.fontFamily, color: Colors.textTertiary },
});

// ─── ReportsShortcut ──────────────────────────────────────────────────────────

export function ReportsShortcut() {
  return (
    <AnimatedPressable
      onPress={() => {
        haptics.light();
        router.push('/(owner)/reports');
      }}
      style={rs.row}
      accessibilityRole="button"
      accessibilityLabel="Open full reports"
    >
      <Text style={rs.text}>Full Reports</Text>
      <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
    </AnimatedPressable>
  );
}

const rs = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
    minHeight: 44,
  },
  text: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.primary },
});

// ─── UpsellCard ───────────────────────────────────────────────────────────────

export function UpsellCard() {
  return (
    <AnimatedPressable
      onPress={() => {
        haptics.light();
        router.push('/(owner)/subscription');
      }}
      style={[uc.card, Shadows.sm]}
      accessibilityRole="button"
      accessibilityLabel="Upgrade to unlock AI insights"
    >
      <View style={uc.iconWrap}>
        <Ionicons name="sparkles" size={22} color={Colors.accentDark} />
      </View>
      <Text style={uc.title}>Unlock AI Insights</Text>
      <Text style={uc.body}>
        Get a daily business health score and a plain-language explanation of what changed and what to do next.
      </Text>
      <View style={uc.cta}>
        <Text style={uc.ctaText}>Upgrade Plan</Text>
      </View>
    </AnimatedPressable>
  );
}

const uc = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, marginBottom: 6 },
  body: { fontSize: Typography.size.small, lineHeight: 20, fontFamily: Typography.fontFamily, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  cta: { paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: BorderRadius.md, backgroundColor: Colors.primary },
  ctaText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.white },
});
