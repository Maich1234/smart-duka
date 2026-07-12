import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface DashboardHeaderProps {
  greeting: string;
  shopName: string;
  formattedDate: string;
  shopInitials: string;
  lowStockCount: number;
  insetsTop: number;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  greeting,
  shopName,
  formattedDate,
  shopInitials,
  lowStockCount,
  insetsTop,
}) => {
  return (
    <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
      <LinearGradient
        colors={[Colors.white, Colors.background]}
        style={[styles.headerGradient, { paddingTop: insetsTop + 12 }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.shopName} numberOfLines={1}>
              {shopName}
            </Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={12} color={Colors.textTertiary} />
              <Text style={styles.dateText}>{formattedDate}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <AnimatedPressable
              style={styles.notifButton}
              onPress={() => router.push('/(owner)/inventory')}
              accessibilityRole="button"
              accessibilityLabel="View low stock alerts in inventory"
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
              {lowStockCount > 0 && <View style={styles.notifDot} />}
            </AnimatedPressable>
            <AnimatedPressable
              style={styles.avatarButton}
              onPress={() => router.push('/(owner)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarInitials}>{shopInitials}</Text>
              </LinearGradient>
            </AnimatedPressable>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.md,
  },
  headerGradient: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
  },
  shopName: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.danger,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  avatarButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarGradient: {
    width: 40,
    height: 40,
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
