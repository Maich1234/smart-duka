import React from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { getStaffDashboard } from '@/services/dashboard';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { ListRow } from '@/components/ui/ListRow';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';

export default function StaffDashboard() {
  const user = useAuthStore((s: AuthState) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const canManageExpenses = usePermission('manage_expenses');
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staffDashboard'],
    queryFn: getStaffDashboard,
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
        <Text style={styles.greeting}>Welcome,</Text>
        <Text style={styles.name}>{user?.name}</Text>
      </View>

      <SalesSummaryCard
        total={dashboard?.todaySalesTotal || 0}
        cash={dashboard?.cashSalesTotal || 0}
        mpesa={dashboard?.mpesaSalesTotal || 0}
        transactions={dashboard?.transactionsToday || 0}
      />

      {canManageExpenses && (
        <View style={styles.navSection}>
          <ListRow
            title="Expenses"
            subtitle="Track rent, supplies & more"
            icon="cash-outline"
            chevron
            isLast
            onPress={() => router.push('/(staff)/expenses')}
          />
        </View>
      )}

      <RecentTransactions transactions={dashboard?.recentSales || []} showStaff={false} />
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  greeting: { fontSize: Typography.size.body, color: Colors.textSecondary },
  name: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  navSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
});
