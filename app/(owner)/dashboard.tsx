import React from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { getOwnerDashboard } from '@/services/dashboard';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { LowStockList } from '@/components/dashboard/LowStockList';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { ListRow } from '@/components/ui/ListRow';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';

export default function OwnerDashboard() {
  const user = useAuthStore((s: AuthState) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ownerDashboard'],
    queryFn: getOwnerDashboard,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  const dashboard = data?.data;

  return (
    <Animated.ScrollView
      entering={FadeIn.duration(Motion.duration.slow)}
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.shopName}>{user?.shop?.name || 'Smart Duka'}</Text>
      </View>

      <SalesSummaryCard
        total={dashboard?.todaySalesTotal || 0}
        cash={dashboard?.cashSalesTotal || 0}
        mpesa={dashboard?.mpesaSalesTotal || 0}
        transactions={dashboard?.transactionsToday || 0}
      />

      <View style={styles.navSection}>
        <ListRow
          title="Sales Reports"
          subtitle="Daily, weekly & monthly insights"
          icon="bar-chart-outline"
          chevron
          onPress={() => router.push('/(owner)/reports')}
        />
        <ListRow
          title="Expenses"
          subtitle="Track rent, supplies & more"
          icon="cash-outline"
          chevron
          isLast
          onPress={() => router.push('/(owner)/expenses')}
        />
      </View>

      <StatsRow
        products={dashboard?.totalProducts || 0}
        stockValue={dashboard?.currentStockValue || 0}
        lowStockCount={dashboard?.lowStockItems?.length || 0}
      />

      <LowStockList items={dashboard?.lowStockItems || []} />

      <RecentTransactions transactions={dashboard?.recentTransactions || []} showStaff />
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  greeting: { fontSize: Typography.size.body, color: Colors.textSecondary },
  shopName: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  navSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
});
