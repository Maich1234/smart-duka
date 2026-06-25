import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { getOwnerDashboard } from '@/services/dashboard';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { LowStockList } from '@/components/dashboard/LowStockList';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

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
    colors: ['#0F766E', '#14B8A6'],
    route: '/(owner)/sales',
  },
  {
    id: 'product',
    title: 'Add Product',
    subtitle: 'Expand inventory',
    icon: 'cube',
    colors: ['#9C6F1E', '#C8932A'],
    route: '/(owner)/inventory/new',
  },
  {
    id: 'expense',
    title: 'Log Expense',
    subtitle: 'Track spending',
    icon: 'receipt',
    colors: ['#9F1239', '#E11D48'],
    route: '/(owner)/expenses',
  },
  {
    id: 'report',
    title: 'Reports',
    subtitle: 'View analytics',
    icon: 'bar-chart',
    colors: ['#1D4ED8', '#3B82F6'],
    route: '/(owner)/reports',
  },
];

const DashboardSkeleton = () => (
  <View style={styles.skeletonContainer}>
    <View style={styles.skeletonHeader}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '60%' }]} />
    </View>
    <View style={styles.skeletonCard} />
    <View style={styles.skeletonGrid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonAction} />
      ))}
    </View>
  </View>
);

export default function OwnerDashboard() {
  const user = useAuthStore((s: AuthState) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ownerDashboard'],
    queryFn: getOwnerDashboard,
  });

  const greeting = useMemo(() => getGreeting(), []);
  const formattedDate = useMemo(() => getFormattedDate(), []);
  const shopInitials = useMemo(
    () => getShopInitials(user?.shop?.name ?? 'Smart Duka'),
    [user?.shop?.name],
  );

  if (isLoading) {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
        <DashboardSkeleton />
      </Animated.View>
    );
  }

  const dashboard = data?.data;

  return (
    <>
      <StatusBar style="dark" />
      <Animated.ScrollView
        entering={FadeIn.duration(400)}
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor="#0F766E"
            colors={['#0F766E']}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* ── Premium header ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
          <LinearGradient
            colors={['#FFFFFF', '#F8FAFC']}
            style={[styles.headerGradient, { paddingTop: insets.top + 12 }]}
          >
            <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.shopName} numberOfLines={1}>
                {user?.shop?.name ?? 'Smart Duka'}
              </Text>
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                <Text style={styles.dateText}>{formattedDate}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.notifButton}
                activeOpacity={0.75}
                onPress={() => {}}
              >
                <Ionicons name="notifications-outline" size={20} color="#64748B" />
                {(dashboard?.lowStockItems?.length ?? 0) > 0 && (
                  <View style={styles.notifDot} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.avatarButton}
                activeOpacity={0.8}
                onPress={() => router.push('/(owner)/profile')}
              >
                <LinearGradient
                  colors={['#0F766E', '#0D3B2E']}
                  style={styles.avatarGradient}
                >
                  <Text style={styles.avatarInitials}>{shopInitials}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ── Hero performance card ────────────────────────────────────── */}
      <SalesSummaryCard
        total={dashboard?.todaySalesTotal ?? 0}
        cash={dashboard?.cashSalesTotal ?? 0}
        mpesa={dashboard?.mpesaSalesTotal ?? 0}
        transactions={dashboard?.transactionsToday ?? 0}
      />

      {/* ── Quick actions grid ───────────────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(420).delay(180)} style={styles.quickSection}>
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action, index) => (
            <Animated.View
              key={action.id}
              entering={FadeInUp.duration(380).delay(220 + index * 60)}
              style={styles.actionWrapper}
            >
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => router.push(action.route as Parameters<typeof router.push>[0])}
                style={styles.actionCard}
              >
                <LinearGradient
                  colors={action.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionGradient}
                >
                  <View style={styles.actionDecorCircle} />
                  <View style={styles.actionIconWrap}>
                    <Ionicons name={action.icon} size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

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
    </>
  );
}

const ACTION_CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - 12) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // ── Header ──────────────────────────────────────────────────────────
  header: {
    marginBottom: Spacing.md,
  },
  headerGradient: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    color: '#64748B',
    fontFamily: Typography.fontFamily,
  },
  shopName: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: '#0F172A',
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
    color: '#94A3B8',
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
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
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
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // ── Quick actions ────────────────────────────────────────────────────
  quickSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#94A3B8',
    letterSpacing: 1.1,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionWrapper: {
    width: ACTION_CARD_WIDTH,
  },
  actionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  actionGradient: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    overflow: 'hidden',
    gap: 2,
  },
  actionDecorCircle: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.1)',
    right: -15,
    top: -15,
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  actionSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: Typography.fontFamily,
    marginTop: 1,
  },

  // ── Skeleton ─────────────────────────────────────────────────────────
  skeletonContainer: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  skeletonHeader: {
    gap: 8,
  },
  skeletonLine: {
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
    width: '80%',
  },
  skeletonCard: {
    height: 180,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skeletonAction: {
    width: ACTION_CARD_WIDTH,
    height: 110,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
});
