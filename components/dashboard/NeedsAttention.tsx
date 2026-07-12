import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import type { AttentionItem, AttentionSeverity } from '@/hooks/useAttention';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const SEVERITY_STYLE: Record<AttentionSeverity, { fg: string; bg: string }> = {
  critical: { fg: Colors.danger, bg: Colors.dangerSubtle },
  warning: { fg: '#B45309', bg: Colors.warningSubtle },
  info: { fg: Colors.info, bg: '#DBEAFE' },
};

interface NeedsAttentionProps {
  items: AttentionItem[];
}

/**
 * Urgency-only section: each row is a problem the user can resolve with one
 * tap. Renders nothing when the list is empty — a calm dashboard IS the
 * empty state, so no placeholder card is shown.
 */
export const NeedsAttention: React.FC<NeedsAttentionProps> = React.memo(({ items }) => {
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>NEEDS ATTENTION</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{items.length}</Text>
        </View>
      </View>

      <View style={styles.card}>
        {items.map((item, index) => {
          const tone = SEVERITY_STYLE[item.severity];
          const Row = (
            <>
              <View style={[styles.iconChip, { backgroundColor: tone.bg }]}>
                <Ionicons name={item.icon} size={17} color={tone.fg} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
              {item.route ? (
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              ) : null}
            </>
          );

          const rowStyle = [styles.row, index < items.length - 1 && styles.rowBorder];

          return item.route ? (
            <AnimatedPressable
              key={item.id}
              style={rowStyle}
              onPress={() => {
                haptics.light();
                router.push(item.route as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.subtitle}`}
            >
              {Row}
            </AnimatedPressable>
          ) : (
            <View key={item.id} style={rowStyle} accessible accessibilityLabel={`${item.title}. ${item.subtitle}`}>
              {Row}
            </View>
          );
        })}
      </View>
    </View>
  );
});

NeedsAttention.displayName = 'NeedsAttention';

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: Colors.dangerSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.danger,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
});
