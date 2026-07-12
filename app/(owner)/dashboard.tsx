import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenFade } from '@/components/ui/motion';
import { Shimmer } from '@/components/ui/Shimmer';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { getOwnerDashboard } from '@/services/dashboard';
import { useOwnerAttention } from '@/hooks/useAttention';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TodayCard } from '@/components/dashboard/TodayCard';
import { DailyBrief } from '@/components/dashboard/DailyBrief';
import { QuickActions, type QuickActionTile } from '@/components/dashboard/QuickActions';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { GettingStartedChecklist } from '@/components/onboarding/GettingStartedChecklist';
import { TrialBanner } from '@/components/subscription/TrialBanner';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Colors } from '@/constants/Colors';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const getFormattedDate = () =>
  new Date().toLocaleDateString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const getShopInitials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

// Ranked by daily usage: expenses get logged every day, products get added
// weekly, reports get opened when there's a question to answer.
const ACTION_TILES: QuickActionTile[] = [
  { id: 'expense', title: 'Log Expense', icon: 'receipt-outline', tint: Colors.danger, tintBg: Colors.dangerSubtle, route: '/(owner)/expenses' },
  { id: 'product', title: 'Add Product', icon: 'cube-outline', tint: Colors.accentDark, tintBg: Colors.accentSubtle, route: '/(owner)/inventory/new' },
  { id: 'reports', title: 'Reports', icon: 'bar-chart-outline', tint: Colors.info, tintBg: '#DBEAFE', route: '/(owner)/reports' },
];

const DashboardSkeleton = () => (
  <View style={styles.skeletonContainer}>
    <View style={styles.skeletonHeader}>
      <Shimmer height={12} borderRadius={6} style={{ width: '45%' }} />
      <Shimmer height={22} borderRadius={6} style={{ width: '65%', marginTop: 8 }} />
    </View>
    <Shimmer height={190} borderRadius={20} />
    <Shimmer height={150} borderRadius={16} />
    <Shimmer height={56} borderRadius={16} />
    <View style={styles.skeletonTileRow}>
      {[0, 1, 2].map((i) => (
        <Shimmer key={i} height={76} borderRadius={16} style={styles.skeletonTile} />
      ))}
    </View>
  </View>
);

export default function OwnerDashboard() {
  const user = useAuthStore((s: AuthState) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['ownerDashboard'],
    queryFn: getOwnerDashboard,
  });

  const [timeContext, setTimeContext] = useState({
    greeting: getGreeting(),
    formattedDate: getFormattedDate(),
  });
  useEffect(() => {
    const id = setInterval(() => {
      const next = { greeting: getGreeting(), formattedDate: getFormattedDate() };
      // Only re-render when the minute tick actually crossed a boundary.
      setTimeContext((prev) =>
        prev.greeting === next.greeting && prev.formattedDate === next.formattedDate ? prev : next,
      );
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const shopInitials = useMemo(
    () => getShopInitials(user?.shop?.name ?? 'Smart Duka'),
    [user?.shop?.name],
  );

  const dashboard = data?.data;
  const attentionItems = useOwnerAttention(dashboard);

  // Bell press scrolls to the attention zone rather than leaving the screen.
  const scrollRef = useRef<ScrollView>(null);
  const attentionY = useRef(0);
  const scrollToAttention = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(attentionY.current - 12, 0), animated: true });
  }, []);

  if (isLoading) {
    return (
      <ScreenFade rise={0} style={styles.container}>
        <DashboardSkeleton />
      </ScreenFade>
    );
  }

  // Full-screen error only when there is nothing to show. With cached data
  // (offline relaunch, flaky network) the dashboard renders the last synced
  // day and pull-to-refresh stays available — never block on connectivity.
  if (isError && !dashboard) {
    return (
      <ScreenFade rise={0} style={[styles.container, styles.errorCenter]}>
        <Ionicons name="cloud-offline-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.errorTitle}>Could not load dashboard</Text>
        <Text style={styles.errorSub}>Check your connection and try again.</Text>
        <AnimatedPressable onPress={() => refetch()} style={styles.retryBtn}>
          <Ionicons name="refresh-outline" size={16} color={Colors.white} />
          <Text style={styles.retryBtnText}>Retry</Text>
        </AnimatedPressable>
      </ScreenFade>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <ScreenFade style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
              progressViewOffset={insets.top}
            />
          }
        >
          {/* 1 · Who and when */}
          <DashboardHeader
            greeting={timeContext.greeting}
            shopName={user?.shop?.name ?? 'Smart Duka'}
            formattedDate={timeContext.formattedDate}
            shopInitials={shopInitials}
            attentionCount={attentionItems.length}
            onBellPress={scrollToAttention}
            profileRoute="/(owner)/profile"
            insetsTop={insets.top}
          />

          {/* 2 · How is my business today? */}
          <TodayCard
            total={dashboard?.todaySalesTotal ?? 0}
            cash={dashboard?.cashSalesTotal ?? 0}
            mpesa={dashboard?.mpesaSalesTotal ?? 0}
            transactions={dashboard?.transactionsToday ?? 0}
            profit={dashboard?.todayProfit}
            yesterdayTotal={dashboard?.yesterdaySalesTotal}
          />

          {/* 3 · What does it mean? */}
          <DailyBrief data={dashboard} />

          {/* First-week checklist — self-retires once the shop is running */}
          <GettingStartedChecklist />

          {/* 4 · What should I do next? */}
          <QuickActions primaryRoute="/(owner)/sales" tiles={ACTION_TILES} />

          {/* 5 · Is anything wrong? Whole zone unmounts when nothing is. */}
          <View onLayout={(e) => { attentionY.current = e.nativeEvent.layout.y; }}>
            <TrialBanner />
            <NeedsAttention items={attentionItems} />
          </View>

          {/* 6 · Pulse check on the till */}
          <RecentActivity
            transactions={dashboard?.recentTransactions ?? []}
            viewAllRoute="/(owner)/sales"
            showStaff
          />
        </ScrollView>
      </ScreenFade>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Error state ──────────────────────────────────────────────────────
  errorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: 10,
  },
  errorTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 8,
  },
  errorSub: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  retryBtnText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.white,
  },

  // ── Skeleton — mirrors the real layout so load doesn't reflow ────────
  skeletonContainer: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  skeletonHeader: {
    paddingTop: Spacing.xl,
    gap: 4,
  },
  skeletonTileRow: {
    flexDirection: 'row',
    gap: 10,
  },
  skeletonTile: {
    flex: 1,
  },
});
