import React from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScrollView } from 'react-native-gesture-handler';
import { ScreenFade } from '@/components/ui/motion';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { getStaffDashboard } from '@/services/dashboard';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { ListRow } from '@/components/ui/ListRow';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function StaffDashboard() {
  const user = useAuthStore((s: AuthState) => s.user);
  const tabBarHeight = useBottomTabBarHeight();
  const canManageExpenses = usePermission('manage_expenses');
  const { data, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['staffDashboard'],
    queryFn: getStaffDashboard,
  });

  if (isLoading) {
    return <ListSkeleton rows={4} heroHeight={180} />;
  }

  if (isError) {
    return (
      <ScreenFade rise={0} style={styles.errorCenter}>
        <Ionicons name="cloud-offline-outline" size={48} color="#94A3B8" />
        <Text style={styles.errorTitle}>Could not load dashboard</Text>
        <Text style={styles.errorSub}>Check your connection and try again.</Text>
        <AnimatedPressable onPress={() => refetch()} style={styles.retryBtn}>
          <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Retry</Text>
        </AnimatedPressable>
      </ScreenFade>
    );
  }

  const dashboard = data?.data;

  return (
    <ScreenFade style={styles.container}>
    <ScrollView
      style={styles.flex}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
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
    </ScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  greeting: { fontSize: Typography.size.body, color: Colors.textSecondary },
  name: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  navSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
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
    color: '#FFFFFF',
  },
});
