import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

export interface QuickActionTile {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Icon color; its subtle background is derived per-tile below. */
  tint: string;
  tintBg: string;
  route: string;
}

interface QuickActionsProps {
  /** The one action the whole business runs on — rendered full-width. */
  primaryTitle?: string;
  primaryIcon?: keyof typeof Ionicons.glyphMap;
  primaryRoute: string;
  /** Up to three supporting actions, rendered as a compact tile row. */
  tiles: QuickActionTile[];
}

/**
 * Actions ranked by real usage frequency: selling is the job, so New Sale is
 * a full-width primary button in easy thumb reach; everything else is a
 * lightweight tile. Flex-based layout — no Dimensions math — so it adapts to
 * any screen width, split screen, and foldables.
 */
export const QuickActions: React.FC<QuickActionsProps> = React.memo(
  ({ primaryTitle = 'New Sale', primaryIcon = 'cart', primaryRoute, tiles }) => {
    const go = (route: string) => {
      haptics.light();
      router.push(route as never);
    };

    return (
      <View style={styles.section}>
        <AnimatedPressable
          onPress={() => go(primaryRoute)}
          style={styles.primaryWrapper}
          accessibilityRole="button"
          accessibilityLabel={primaryTitle}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButton}
          >
            <View style={styles.primaryIconWrap}>
              <Ionicons name={primaryIcon} size={20} color={Colors.white} />
            </View>
            <Text style={styles.primaryTitle}>{primaryTitle}</Text>
            <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.85)" />
          </LinearGradient>
        </AnimatedPressable>

        {tiles.length > 0 && (
          <View style={styles.tileRow}>
            {tiles.map((tile) => (
              <AnimatedPressable
                key={tile.id}
                onPress={() => go(tile.route)}
                style={styles.tile}
                accessibilityRole="button"
                accessibilityLabel={tile.title}
              >
                <View style={[styles.tileIconWrap, { backgroundColor: tile.tintBg }]}>
                  <Ionicons name={tile.icon} size={18} color={tile.tint} />
                </View>
                <Text style={styles.tileTitle} numberOfLines={1}>
                  {tile.title}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        )}
      </View>
    );
  },
);

QuickActions.displayName = 'QuickActions';

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: 10,
  },
  primaryWrapper: {
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 56,
  },
  primaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryTitle: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.white,
    letterSpacing: -0.2,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingVertical: 14,
    minHeight: 76,
    ...Shadows.sm,
  },
  tileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
});
