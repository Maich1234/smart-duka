import React from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { getOwnerDashboard } from '@/services/dashboard';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { LowStockList } from '@/components/dashboard/LowStockList';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

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
    <ScrollView
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

      <TouchableOpacity onPress={() => router.push('/(owner)/reports')} activeOpacity={0.7}>
        <Card style={styles.reportsCard}>
          <View style={styles.reportsIcon}>
            <Ionicons name="bar-chart" size={22} color={Colors.primary} />
          </View>
          <View style={styles.reportsTextWrap}>
            <Text style={styles.reportsTitle}>Sales Reports</Text>
            <Text style={styles.reportsSubtitle}>Daily, weekly &amp; monthly insights</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
        </Card>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/(owner)/expenses')} activeOpacity={0.7}>
        <Card style={styles.reportsCard}>
          <View style={[styles.reportsIcon, styles.expensesIcon]}>
            <Ionicons name="cash-outline" size={22} color={Colors.accentDark} />
          </View>
          <View style={styles.reportsTextWrap}>
            <Text style={styles.reportsTitle}>Expenses</Text>
            <Text style={styles.reportsSubtitle}>Track rent, supplies &amp; more</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
        </Card>
      </TouchableOpacity>

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
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  greeting: { fontSize: Typography.size.body, color: Colors.textSecondary },
  shopName: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  reportsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  reportsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  expensesIcon: { backgroundColor: Colors.accentSubtle },
  reportsTextWrap: { flex: 1 },
  reportsTitle: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  reportsSubtitle: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
});
