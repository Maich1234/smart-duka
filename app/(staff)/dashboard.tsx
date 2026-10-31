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
import { getStaffDashboard } from '@/services/dashboard';
import { getShopConfig } from '@/services/shop';
import { useStaffAttention } from '@/hooks/useAttention';
import { useUnreadNotificationsCount } from '@/hooks/useNotifications';
import { StaffLockBanner } from '@/components/subscription/StaffLockBanner';
import type { HomeMenuGroup } from '@/components/dashboard/HomeMenu';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TodayCard } from '@/components/dashboard/TodayCard';
import { QuickActions, type QuickActionTile } from '@/components/dashboard/QuickActions';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

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

const getInitials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export default function StaffDashboard() {
  const user = useAuthStore((s: AuthState) => s.user);
  const tabBarHeight = useTabBarHeight();
  const insets = useSafeAreaInsets();
  const canManageExpenses = usePermission('manage_expenses');
  const canViewPurchases = usePermission('view_purchases');
  const canViewReconciliation = usePermission('view_reconciliation');
  // Either grant is enough to see the list — matches getQuotations' own
  // permission check (create_quotation for drafting, convert_quotation_to_sale
  // for a view-only look at converting one to a sale).
  const canCreateQuotation = usePermission('create_quotation');
  const canConvertQuotation = usePermission('convert_quotation_to_sale');
  // Same eligibility the backend applies (customerController.canListCustomers):
  // any credit grant, or just being able to record a sale — the directory
  // doubles as the till's customer picker. Each usePermission is its own
  // hook and must run unconditionally every render, so every check happens
  // before they're combined — `||`'d directly, they'd short-circuit and skip
  // whichever calls come after the first true one.
  const canRecordSaleForCustomers = usePermission('record_sale');
  const canMakeCreditSaleTile = usePermission('make_credit_sale');
  const canRecordCreditPaymentTile = usePermission('record_credit_payment');
  const canViewOwnCreditTile = usePermission('view_own_credit');
  const canViewAllCreditTile = usePermission('view_all_credit');
  const canOpenCustomers = canRecordSaleForCustomers
    || canMakeCreditSaleTile
    || canRecordCreditPaymentTile
    || canViewOwnCreditTile
    || canViewAllCreditTile;
  const { data, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['staffDashboard'],
    queryFn: getStaffDashboard,
  });
  const { data: shopConfigData } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });
  const showPurchasesTile = canViewPurchases && (shopConfigData?.data?.purchasingEnabled ?? false);
  // Commission is hidden outright for anyone not on it — both when the shop
  // doesn't publish commission at all, and when this person specifically isn't
  // earning any. A tile leading to a permanent zero reads as a broken feature.
  const showCommissionTile =
    (shopConfigData?.data?.showStaffCommission ?? false) && user?.commissionEligible === true;
  const showReconciliationTile =
    canViewReconciliation && (shopConfigData?.data?.shiftManagementEnabled ?? false);
  const showQuotationsTile = canCreateQuotation || canConvertQuotation;

  const [timeContext, setTimeContext] = useState({
    greeting: getGreeting(),
    formattedDate: getFormattedDate(),
  });
  useEffect(() => {
    const id = setInterval(() => {
      const next = { greeting: getGreeting(), formattedDate: getFormattedDate() };
      setTimeContext((prev) =>
        prev.greeting === next.greeting && prev.formattedDate === next.formattedDate ? prev : next,
      );
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const attentionItems = useStaffAttention();
  const initials = useMemo(() => getInitials(user?.name ?? 'S'), [user?.name]);

  const tiles = useMemo<QuickActionTile[]>(() => {
    const list: QuickActionTile[] = [
      { id: 'inventory', title: 'Stock', icon: 'cube-outline', tint: Colors.accentDark, tintBg: Colors.accentSubtle, route: '/(staff)/inventory' },
    ];
    if (canOpenCustomers) {
      list.push({ id: 'customers', title: 'Customers', icon: 'people-outline', tint: Colors.info, tintBg: '#EFF6FF', route: '/(staff)/customers' });
    }
    if (canManageExpenses) {
      list.unshift({ id: 'expense', title: 'Log Expense', icon: 'receipt-outline', tint: Colors.danger, tintBg: Colors.dangerSubtle, route: '/(staff)/expenses' });
    }
    if (showPurchasesTile) {
      list.unshift({ id: 'purchases', title: 'Purchases', icon: 'cart-outline', tint: Colors.primary, tintBg: Colors.primarySubtle, route: '/(staff)/purchases' });
    }
    if (showCommissionTile) {
      list.push({ id: 'commission', title: 'My Commission', icon: 'cash-outline', tint: Colors.success, tintBg: Colors.primarySubtle, route: '/(staff)/commission' });
    }
    if (showReconciliationTile) {
      list.push({ id: 'reconciliation', title: 'My Reconciliation', icon: 'swap-horizontal-outline', tint: Colors.info, tintBg: Colors.primarySubtle, route: '/(staff)/reconciliation' });
    }
    if (showQuotationsTile) {
      list.push({ id: 'quotations', title: 'Quotations', icon: 'document-text-outline', tint: Colors.warning, tintBg: Colors.warningSubtle, route: '/(staff)/quotations' });
    }
    // Always shown, same as the owner's equivalent tab — whether the
    // program is currently live is a platform-wide toggle, not a per-person
    // eligibility check, so refer.tsx itself renders the "not live yet"
    // state rather than the tile disappearing.
    list.push({ id: 'refer', title: 'Refer & Earn', icon: 'gift-outline', tint: Colors.primaryDark, tintBg: Colors.primarySubtle, route: '/(staff)/refer' });
    return list;
  }, [canManageExpenses, showPurchasesTile, showCommissionTile, showReconciliationTile, showQuotationsTile, canOpenCustomers]);

  const unreadCount = useUnreadNotificationsCount();
  // Stable reference so the 60s unread-count poll (see useUnreadNotificationsCount)
  // doesn't defeat DashboardHeader's React.memo on every tick.
  const menuGroups: HomeMenuGroup[] = [
    { title: 'Your work', items: tiles },
    { title: 'Account & equipment', items: [
      { title: 'Profile & help', route: '/(staff)/profile', icon: 'person-outline' },
      { title: 'Receipt printer', route: '/(staff)/printer', icon: 'print-outline' },
    ] },
  ];

  const handleBellPress = useCallback(() => router.push('/(staff)/notifications'), []);

  const dashboard = data?.data;

  if (isLoading || (isError && !dashboard)) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}>
        <DashboardHeader greeting={timeContext.greeting} shopName={user?.shop?.name ?? 'DuQana'}
          formattedDate={timeContext.formattedDate} shopInitials={initials} unreadCount={unreadCount}
          onBellPress={handleBellPress} profileRoute="/(staff)/profile" insetsTop={insets.top} menuGroups={menuGroups} />
        {canRecordSaleForCustomers && <QuickActions primaryRoute="/(staff)/sales" tiles={[]} />}
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
      <ScreenFade style={styles.container}>
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} colors={[Colors.primary]} progressViewOffset={insets.top} />
          }
        >
          <DashboardHeader
            greeting={timeContext.greeting}
            shopName={user?.shop?.name ?? 'DuQana'}
            formattedDate={timeContext.formattedDate}
            shopInitials={initials}
            unreadCount={unreadCount}
            onBellPress={handleBellPress}
            profileRoute="/(staff)/profile"
            menuGroups={menuGroups}
            insetsTop={insets.top}
          />

          <StaffLockBanner />

          {canRecordSaleForCustomers && <QuickActions primaryRoute="/(staff)/sales" tiles={[]} />}

          {isError && <Text accessibilityRole="alert" style={[styles.errorSub, { marginHorizontal: Spacing.md, marginBottom: Spacing.sm }]}>Could not refresh today’s figures. Showing the last saved figures. Pull down to retry.</Text>}

          <TodayCard
            total={dashboard?.todaySalesTotal ?? 0}
            cash={dashboard?.cashSalesTotal ?? 0}
            mpesa={dashboard?.mpesaSalesTotal ?? 0}
            transactions={dashboard?.transactionsToday ?? 0}
            yesterdayTotal={dashboard?.yesterdaySalesTotal}
          />

          <QuickActions hidePrimary primaryRoute="/(staff)/sales" tiles={tiles.filter((tile) => !['refer', 'commission', 'reconciliation', 'quotations'].includes(tile.id)).slice(0, 3)} />

          <NeedsAttention items={attentionItems} />

          <RecentActivity
            transactions={dashboard?.recentSales ?? []}
            viewAllRoute="/(staff)/sales"
          />
        </ScrollView>
      </ScreenFade>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  errorCenter: {
    flex: 1,
    backgroundColor: Colors.background,
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
});
