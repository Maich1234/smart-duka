import React, { useMemo, useState, useEffect } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ScreenFade, CrossfadeCircle } from '@/components/ui/motion';
import { LinearGradient } from 'expo-linear-gradient';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { getOwnerDashboard } from '@/services/dashboard';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { GettingStartedChecklist } from '@/components/onboarding/GettingStartedChecklist';
import { TrialBanner } from '@/components/subscription/TrialBanner';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { LowStockList } from '@/components/dashboard/LowStockList';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { QuickActions, type QuickAction } from '@/components/dashboard/QuickActions';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Shimmer } from '@/components/ui/Shimmer';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const getFormattedDate = () =>
  new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

const getShopInitials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
  route: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'sale',
    title: 'New Sale',
    subtitle: 'Record transaction',
    icon: 'cart',
    colors: [Colors.primary, Colors.primaryLight],
    route: '/(owner)/sales',
  },
  {
    id: 'product',
    title: 'Add Product',
    subtitle: 'Expand inventory',
    icon: 'cube',
    colors: [Colors.accentDark, Colors.accent],
    route: '/(owner)/inventory/new',
  },
  {
    id: 'expense',
    title: 'Log Expense',
    subtitle: 'Track spending',
    icon: 'receipt',
    colors: ['#9F1239', Colors.danger], // Danger gradient
    route: '/(owner)/expenses',
  },
  {
    id: 'report',
    title: 'Reports',
    subtitle: 'View analytics',
    icon: 'bar-chart',
    colors: ['#1D4ED8', Colors.info], // Info gradient
    route: '/(owner)/reports',
  },
];

const DashboardSkeleton = () => (
  <View style={styles.skeletonContainer}>
    <View style={styles.skeletonHeader}>
      <Shimmer height={14} borderRadius={7} style={{ width: '50%' }} />
      <Shimmer height={22} borderRadius={6} style={{ width: '70%', marginTop: 6 }} />
      <Shimmer height={12} borderRadius={6} style={{ width: '35%', marginTop: 6 }} />
    </View>
    <Shimmer height={180} borderRadius={24} style={styles.skeletonCard} />
    <View style={styles.skeletonGrid}>
      {[0, 1, 2, 3].map((i) => (
        <Shimmer key={i} height={110} borderRadius={20} style={styles.skeletonAction} />
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
      setTimeContext({ greeting: getGreeting(), formattedDate: getFormattedDate() });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const shopInitials = useMemo(
    () => getShopInitials(user?.shop?.name ?? 'Smart Duka'),
    [user?.shop?.name],
  );

  if (isLoading) {
    return (
      <ScreenFade rise={0} style={styles.container}>
        <DashboardSkeleton />
      </ScreenFade>
    );
  }

  if (isError) {
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

  const dashboard = data?.data;

  return (
    <>
      <StatusBar style="dark" />
      <ScreenFade style={styles.flex}>
      <Animated.ScrollView
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
        {/* ── Premium header ──────────────────────────────────────────── */}
        <DashboardHeader
          greeting={timeContext.greeting}
          shopName={user?.shop?.name ?? 'Smart Duka'}
          formattedDate={timeContext.formattedDate}
          shopInitials={shopInitials}
          lowStockCount={dashboard?.lowStockItems?.length ?? 0}
          insetsTop={insets.top}
        />

      {/* ── Hero performance card ────────────────────────────────────── */}
      <SalesSummaryCard
        total={dashboard?.todaySalesTotal ?? 0}
        cash={dashboard?.cashSalesTotal ?? 0}
        mpesa={dashboard?.mpesaSalesTotal ?? 0}
        transactions={dashboard?.transactionsToday ?? 0}
      />

      {/* ── Subscription nudge (trial ending / grace period / not activated) ── */}
      <TrialBanner />

      {/* ── First-week checklist (self-retires once the shop is running) ── */}
      <GettingStartedChecklist />

      {/* ── Quick actions grid ───────────────────────────────────────── */}
      <QuickActions actions={QUICK_ACTIONS} />

      {/* ── Insight cards ────────────────────────────────────────────── */}
      <StatsRow
        products={dashboard?.totalProducts ?? 0}
        stockValue={dashboard?.currentStockValue ?? 0}
        lowStockCount={dashboard?.lowStockItems?.length ?? 0}
      />

      {/* ── Smart alerts ─────────────────────────────────────────────── */}
      <LowStockList items={dashboard?.lowStockItems ?? []} />

      {/* ── Recent transactions ──────────────────────────────────────── */}
      <RecentTransactions
        transactions={dashboard?.recentTransactions ?? []}
        showStaff
      />
      </Animated.ScrollView>
      </ScreenFade>
    </>
  );
}

const ACTION_CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - 12) / 2;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },



  // ── Error state ─────────────────────────────────────────────────────────
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

  // ── Skeleton ─────────────────────────────────────────────────────────
  skeletonContainer: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  skeletonHeader: {
    gap: 4,
  },
  skeletonCard: {
    marginTop: 4,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skeletonAction: {
    width: ACTION_CARD_WIDTH,
  },
});
