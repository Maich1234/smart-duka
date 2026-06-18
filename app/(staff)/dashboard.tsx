import React from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { getStaffDashboard } from '@/services/dashboard';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function StaffDashboard() {
  const user = useAuthStore((s: AuthState) => s.user);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staffDashboard'],
    queryFn: getStaffDashboard,
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
        <Text style={styles.greeting}>Welcome,</Text>
        <Text style={styles.name}>{user?.name}</Text>
      </View>

      <SalesSummaryCard
        total={dashboard?.todaySalesTotal || 0}
        cash={dashboard?.cashSalesTotal || 0}
        mpesa={dashboard?.mpesaSalesTotal || 0}
        transactions={dashboard?.transactionsToday || 0}
      />

      <RecentTransactions transactions={dashboard?.recentSales || []} showStaff={false} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  greeting: { fontSize: Typography.size.body, color: Colors.textSecondary },
  name: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
});
