import { usePriceAttention } from '@/hooks/usePriceAttention';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenFade } from '@/components/ui/motion';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { getOwnerDashboard } from '@/services/dashboard';
import { getShopConfig } from '@/services/shop';
import { useOwnerAttention } from '@/hooks/useAttention';
import { useUnreadNotificationsCount } from '@/hooks/useNotifications';
import type { HomeMenuGroup } from '@/components/dashboard/HomeMenu';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TodayCard } from '@/components/dashboard/TodayCard';
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
// weekly, reports get opened when there's a question to answer. Purchases
// sits with expenses — restocking is a similarly frequent workflow — but
// only appears once the owner has turned the module on (see profile.tsx).
const BASE_ACTION_TILES: QuickActionTile[] = [
  { id: 'expense', title: 'Log Expense', icon: 'receipt-outline', tint: Colors.danger, tintBg: Colors.dangerSubtle, route: '/(owner)/expenses' },
  { id: 'product', title: 'Add Product', icon: 'cube-outline', tint: Colors.accentDark, tintBg: Colors.accentSubtle, route: '/(owner)/inventory/new' },
  { id: 'reports', title: 'Reports', icon: 'bar-chart-outline', tint: Colors.info, tintBg: '#DBEAFE', route: '/(owner)/reports' },
];
const PURCHASES_TILE: QuickActionTile = {
  id: 'purchases', title: 'Purchases', icon: 'cart-outline', tint: Colors.primary, tintBg: Colors.primarySubtle, route: '/(owner)/purchases',
};
const QUOTATIONS_TILE: QuickActionTile = {
  id: 'quotations', title: 'Quotations', icon: 'document-text-outline', tint: Colors.warning, tintBg: Colors.warningSubtle, route: '/(owner)/quotations',
};

export default function OwnerDashboard() {
  const user = useAuthStore((s: AuthState) => s.user);
  const tabBarHeight = useTabBarHeight();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['ownerDashboard'],
    queryFn: getOwnerDashboard,
  });

  const canViewPurchases = usePermission('view_purchases');
  const { data: shopConfigData } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });
  const showPurchasesTile = canViewPurchases && (shopConfigData?.data?.purchasingEnabled ?? false);
  // Either grant is enough to see the list — matches getQuotations' own
  // permission check (create_quotation for drafting, convert_quotation_to_sale
  // for a view-only look at converting one to a sale).
  const canCreateQuotation = usePermission('create_quotation');
  const canConvertQuotation = usePermission('convert_quotation_to_sale');
  const showQuotationsTile = canCreateQuotation || canConvertQuotation;
  const actionTiles = useMemo(() => {
    const base = showPurchasesTile ? [BASE_ACTION_TILES[0], PURCHASES_TILE, ...BASE_ACTION_TILES.slice(1)] : BASE_ACTION_TILES;
    return showQuotationsTile ? [...base, QUOTATIONS_TILE] : base;
  }, [showPurchasesTile, showQuotationsTile]);

  const menuGroups: HomeMenuGroup[] = [
    { title: 'Sales & customers', items: [
      { title: 'Sales & receipts', route: '/(owner)/sales', icon: 'receipt-outline' },
      { title: 'Customers', route: '/(owner)/customers', icon: 'people-outline' },
      { title: 'Customer balances', route: '/(owner)/credit', icon: 'wallet-outline' },
      ...(showQuotationsTile ? [QUOTATIONS_TILE] : []),
    ] },
    { title: 'Stock & money', items: [
      BASE_ACTION_TILES[1],
      ...(showPurchasesTile ? [PURCHASES_TILE] : []),
      { title: 'Price checks', route: '/(owner)/price-alerts', icon: 'pricetag-outline' },
      BASE_ACTION_TILES[0], BASE_ACTION_TILES[2],
      { title: 'Business overview', route: '/(owner)/business', icon: 'business-outline' },
      { title: 'Insights', route: '/(owner)/insights', icon: 'bulb-outline' },
      ...(shopConfigData?.data?.aiEnabled ? [{ title: 'Ask DuQana', route: '/(owner)/chat', icon: 'chatbubble-outline' }] : []),
    ] },
    { title: 'Manage your shop', items: [
      { title: 'Staff & permissions', route: '/(owner)/staff', icon: 'people-outline' },
      { title: 'Settings & account', route: '/(owner)/profile', icon: 'settings-outline' },
      { title: 'Subscription', route: '/(owner)/subscription', icon: 'card-outline' },
      { title: 'Setup & help', route: '/(owner)/setup-guide', icon: 'help-circle-outline' },
    ] },
  ];

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
    () => getShopInitials(user?.shop?.name ?? 'DuQana'),
    [user?.shop?.name],
  );

  const dashboard = data?.data;
  const operationalAttention = useOwnerAttention(dashboard);
  const priceAttention = usePriceAttention();
  const attentionItems = [...operationalAttention, ...priceAttention];
  const unreadCount = useUnreadNotificationsCount();
  // Stable reference so the 60s unread-count poll (see useUnreadNotificationsCount)
  // doesn't defeat DashboardHeader's React.memo on every tick.
  const handleBellPress = useCallback(() => router.push('/(owner)/notifications'), []);

  if (isLoading || (isError && !dashboard)) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}>
        <DashboardHeader greeting={timeContext.greeting} shopName={user?.shop?.name ?? 'DuQana'}
          formattedDate={timeContext.formattedDate} shopInitials={shopInitials} unreadCount={unreadCount}
          onBellPress={handleBellPress} profileRoute="/(owner)/profile" insetsTop={insets.top} menuGroups={menuGroups} />
        {true && <QuickActions primaryRoute="/(owner)/pos" tiles={[]} />}
        <View style={{ padding: Spacing.md, gap: 12 }}>
          <Text style={styles.errorTitle}>{isLoading ? 'Loading today’s figures' : 'Today’s figures are unavailable'}</Text>
          <Text style={styles.errorSub}>You can still open your shop tools. Figures will appear when the connection recovers.</Text>
          {!isLoading && <AnimatedPressable accessibilityRole="button" accessibilityLabel="Retry loading today’s figures" onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry loading figures</Text>
          </AnimatedPressable>}
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <ScreenFade style={styles.flex}>
        <ScrollView
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
            shopName={user?.shop?.name ?? 'DuQana'}
            formattedDate={timeContext.formattedDate}
            shopInitials={shopInitials}
            unreadCount={unreadCount}
            onBellPress={handleBellPress}
            profileRoute="/(owner)/profile"
            menuGroups={menuGroups}
            insetsTop={insets.top}
          />

          <QuickActions primaryRoute="/(owner)/pos" tiles={[]} />

          {/* Today at a glance */}
          {isError && <Text accessibilityRole="alert" style={[styles.errorSub, { marginHorizontal: Spacing.md, marginBottom: Spacing.sm }]}>Could not refresh today’s figures. Showing the last saved figures. Pull down to retry.</Text>}

          <TodayCard
            total={dashboard?.todaySalesTotal ?? 0}
            cash={dashboard?.cashSalesTotal ?? 0}
            mpesa={dashboard?.mpesaSalesTotal ?? 0}
            transactions={dashboard?.transactionsToday ?? 0}
            profit={dashboard?.todayProfit}
            yesterdayTotal={dashboard?.yesterdaySalesTotal}
          />

          <QuickActions hidePrimary primaryRoute="/(owner)/pos" tiles={actionTiles.filter((tile) => tile.id !== 'quotations').slice(0, 3)} />

          {/* 5 · Is anything wrong? Whole zone unmounts when nothing is. */}
          <TrialBanner />
          <NeedsAttention items={attentionItems} />

          <GettingStartedChecklist />

          {/* Recent sales */}
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
