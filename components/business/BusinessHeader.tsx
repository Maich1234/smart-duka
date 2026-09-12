import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Shimmer } from '@/components/ui/Shimmer';
import { haptics } from '@/utils/haptics';
import { money } from './BusinessPrimitives';
import { formatRelativeTime } from '@/utils/formatters';
import { useIsStale } from '@/hooks/useIsStale';
import type { BusinessOverview } from '@/services/business';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface BusinessHeaderProps {
  overview?: BusinessOverview;
  currency?: string;
  onCapitalPress: () => void;
  /** When these figures were last fetched (react-query's dataUpdatedAt). */
  updatedAt?: number;
}

/**
 * Past this, the figures are labelled with when they were fetched.
 *
 * Offline-first means the owner can open this screen with no signal and see
 * the last synced position — which is the right behaviour, and misleading
 * without a timestamp. Age, not connectivity, is the honest trigger: a
 * request that silently failed leaves stale numbers on screen while NetInfo
 * still reports a connection.
 */
const STALE_AFTER_MS = 2 * 60 * 1000;

/**
 * The collapsing header: one number the owner came for, and the two that put
 * it in context. Everything else lives in a tab.
 *
 * The capital figure is a control, not a label — tapping it opens the
 * breakdown. A headline estimate with no visible derivation is the exact
 * thing that makes a business tool feel like it is guessing.
 */
export const BusinessHeader: React.FC<BusinessHeaderProps> = ({
  overview,
  currency,
  onCapitalPress,
  updatedAt,
}) => {
  const capital = overview?.capital;
  const loading = !overview;
  const stale = useIsStale(updatedAt, STALE_AFTER_MS);

  return (
    <View style={s.wrap}>
      <AnimatedPressable
        onPress={() => { haptics.light(); onCapitalPress(); }}
        style={s.capitalPress}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={
          capital
            ? `Estimated capital ${money(capital.estimatedPosition, currency)}. Show how this was worked out.`
            : 'Estimated capital, loading'
        }
      >
        <View style={s.capitalRow}>
          <Text style={s.capitalLabel}>Estimated Capital</Text>
          <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
        </View>
        {loading ? (
          <Shimmer height={36} borderRadius={8} style={s.capitalSkeleton} />
        ) : (
          <Text
            style={s.capitalValue}
            adjustsFontSizeToFit
            numberOfLines={1}
            minimumFontScale={0.55}
          >
            {money(capital!.estimatedPosition, currency)}
          </Text>
        )}
      </AnimatedPressable>

      {stale && (
        <View style={s.staleRow}>
    <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
          <Text style={s.staleText}>{`Updated ${formatRelativeTime(new Date(updatedAt!))}`}</Text>
        </View>
      )}

      <View style={s.miniRow}>
        <Mini label="Today's sales" value={overview ? money(overview.today.total, currency) : undefined} />
        <View style={s.miniDivider} />
        <Mini label="Stock at cost" value={overview ? money(overview.inventory.stockAtCost, currency) : undefined} />
      </View>
    </View>
  );
};

const Mini: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <View style={s.mini}>
    <Text style={s.miniLabel}>{label}</Text>
    {value === undefined
      ? <Shimmer height={16} borderRadius={4} style={s.miniSkeleton} />
      : <Text style={s.miniValue} numberOfLines={1}>{value}</Text>}
  </View>
);

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  capitalPress: { alignSelf: 'flex-start', maxWidth: '100%', gap: 2 },
  capitalRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  capitalLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  capitalValue: {
    fontSize: Typography.size.display,
    lineHeight: Typography.lineHeight.display,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -1.2,
  },
  capitalSkeleton: { width: 200, marginTop: 4 },
  staleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -Spacing.sm },
  staleText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  mini: { flex: 1, gap: 2 },
  miniLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  miniValue: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  miniSkeleton: { width: 90, marginTop: 2 },
  miniDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.md,
  },
});
