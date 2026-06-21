import React from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { getStaffDashboard } from '@/services/dashboard';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

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
    <ScrollView
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
        <TouchableOpacity onPress={() => router.push('/(staff)/expenses')} activeOpacity={0.7}>
          <Card style={styles.expensesCard}>
            <View style={styles.expensesIcon}>
              <Ionicons name="cash-outline" size={22} color={Colors.accentDark} />
            </View>
            <View style={styles.expensesTextWrap}>
              <Text style={styles.expensesTitle}>Expenses</Text>
              <Text style={styles.expensesSubtitle}>Track rent, supplies &amp; more</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </Card>
        </TouchableOpacity>
      )}

      <RecentTransactions transactions={dashboard?.recentSales || []} showStaff={false} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  greeting: { fontSize: Typography.size.body, color: Colors.textSecondary },
  name: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },

  expensesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  expensesIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  expensesTextWrap: { flex: 1 },
  expensesTitle: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  expensesSubtitle: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
});
