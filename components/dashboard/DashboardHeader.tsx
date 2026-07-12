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

interface DashboardHeaderProps {
  greeting: string;
  shopName: string;
  formattedDate: string;
  shopInitials: string;
  /** How many items are in Needs Attention — drives the bell badge. */
  attentionCount: number;
  /** Scrolls to the Needs Attention section (or wherever alerts live). */
  onBellPress: () => void;
  profileRoute: string;
  insetsTop: number;
}

/**
 * Identity strip: who you are, what day it is, and one honest signal (the
 * bell badge mirrors the Needs Attention count instead of a vague dot).
 * Flat surface with a hairline — the hero card below carries the visual
 * weight, so the header stays quiet.
 */
export const DashboardHeader: React.FC<DashboardHeaderProps> = React.memo(
  ({ greeting, shopName, formattedDate, shopInitials, attentionCount, onBellPress, profileRoute, insetsTop }) => {
    return (
      <View style={[styles.header, { paddingTop: insetsTop + 10 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>
            {greeting} · {formattedDate}
          </Text>
          <Text style={styles.shopName} numberOfLines={1}>
            {shopName}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <AnimatedPressable
            style={styles.bellButton}
            onPress={() => {
              haptics.light();
              onBellPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={
              attentionCount > 0
                ? `${attentionCount} item${attentionCount === 1 ? '' : 's'} need attention`
                : 'No alerts'
            }
          >
            <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
            {attentionCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{attentionCount > 9 ? '9+' : attentionCount}</Text>
              </View>
            )}
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.avatarButton}
            onPress={() => {
              haptics.light();
              router.push(profileRoute as never);
            }}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.avatarGradient}>
              <Text style={styles.avatarInitials}>{shopInitials}</Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </View>
    );
  },
);

DashboardHeader.displayName = 'DashboardHeader';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: 14,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
  },
  shopName: {
    fontSize: Typography.size.h3,
    lineHeight: Typography.lineHeight.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Colors.danger,
    borderWidth: 1.5,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontSize: 9,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.white,
  },
  avatarButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  avatarGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.white,
    letterSpacing: 0.5,
  },
});
