import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenFade } from '@/components/ui/motion';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { getStaffDashboard } from '@/services/dashboard';
import { useStaffAttention } from '@/hooks/useAttention';
import { useUnreadNotificationsCount } from '@/hooks/useNotifications';
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
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const canManageExpenses = usePermission('manage_expenses');
  const { data, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['staffDashboard'],
    queryFn: getStaffDashboard,
  });

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
    if (canManageExpenses) {
      list.unshift({ id: 'expense', title: 'Log Expense', icon: 'receipt-outline', tint: Colors.danger, tintBg: Colors.dangerSubtle, route: '/(staff)/expenses' });
    }
    list.push({ id: 'commission', title: 'My Commission', icon: 'cash-outline', tint: Colors.success, tintBg: Colors.primarySubtle, route: '/(staff)/commission' });
    return list;
  }, [canManageExpenses]);

  const unreadCount = useUnreadNotificationsCount();

  if (isLoading) {
    return <ListSkeleton rows={4} heroHeight={180} />;
  }

  const dashboard = data?.data;

  // Only block on error when there's no cached day to show.
  if (isError && !dashboard) {
    return (
      <ScreenFade rise={0} style={styles.errorCenter}>
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
            shopName={user?.name ?? 'Staff'}
            formattedDate={timeContext.formattedDate}
            shopInitials={initials}
            unreadCount={unreadCount}
            onBellPress={() => router.push('/(staff)/notifications')}
            profileRoute="/(staff)/profile"
            insetsTop={insets.top}
          />

          <TodayCard
            total={dashboard?.todaySalesTotal ?? 0}
            cash={dashboard?.cashSalesTotal ?? 0}
            mpesa={dashboard?.mpesaSalesTotal ?? 0}
            transactions={dashboard?.transactionsToday ?? 0}
            yesterdayTotal={dashboard?.yesterdaySalesTotal}
          />

          <QuickActions primaryRoute="/(staff)/sales" tiles={tiles} />

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
