import React from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { getOwnerDashboard } from '@/services/dashboard';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { LowStockList } from '@/components/dashboard/LowStockList';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function OwnerDashboard() {
  const user = useAuthStore((s: AuthState) => s.user);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ownerDashboard'],
    queryFn: getOwnerDashboard,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const dashboard = data?.data;

  return (
    <ScrollView
      style={styles.container}
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

      <StatsRow
        products={dashboard?.totalProducts || 0}
        stockValue={dashboard?.currentStockValue || 0}
        lowStockCount={dashboard?.lowStockItems?.length || 0}
      />

      <LowStockList items={dashboard?.lowStockItems || []} />

      <RecentTransactions transactions={dashboard?.recentTransactions || []} showStaff />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  greeting: { fontSize: Typography.size.body, color: Colors.textSecondary },
  shopName: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
});
