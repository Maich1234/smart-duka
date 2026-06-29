import React, { useState, useEffect } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStaff } from '@/services/staff';
import { StaffCard } from '@/components/staff/StaffCard';
import { ContextualSearchBar } from '@/components/ui/ContextualSearchBar';
import { useSearch } from '@/hooks/useSearch';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';

export default function OwnerStaffList() {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const {
    value: searchValue,
    query: searchQuery,
    onChange: onSearchChange,
    onSubmit: onSearchSubmit,
    selectRecent,
    recentSearches,
    clearRecent,
  } = useSearch('staff');

  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  useEffect(() => { setPage(1); }, [searchQuery, showAll]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staff', searchQuery, page, showAll],
    queryFn: () => getStaff({
      search: searchQuery,
      page,
      limit: 10,
      ...(!showAll ? { startDate: twoDaysAgo } : {}),
    }),
  });

  const staffList = data?.data || [];
  const totalPages = data?.pagination?.pages ?? 1;
  const activeCount = staffList.filter((s) => s.isActive).length;
  const inactiveCount = staffList.filter((s) => !s.isActive).length;

  if (isLoading && staffList.length === 0 && !searchQuery) {
    return <LoadingState />;
  }

  const ListHeader = (
    <>
      {/* ── Hero card ─────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(480).delay(60)} style={styles.heroWrapper}>
        <LinearGradient
          colors={['#0A2318', '#0D4A38', '#0F766E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroDecorCircle} />
          <View style={styles.heroDecorCircleSmall} />

          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroLabel}>Team Overview</Text>
              <Text style={styles.heroValue}>{staffList.length}</Text>
              <Text style={styles.heroSub}>Total team members</Text>
            </View>
            <View style={styles.heroRight}>
              <View style={styles.heroIconBox}>
                <Ionicons name="people" size={20} color="rgba(255,255,255,0.9)" />
              </View>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroMetrics}>
            <View style={styles.heroMetric}>
              <View style={styles.heroDot} />
              <Text style={styles.heroMetricValue}>{activeCount}</Text>
              <Text style={styles.heroMetricLabel}>Active</Text>
            </View>
            <View style={styles.heroMetricSep} />
            <View style={styles.heroMetric}>
              <View style={[styles.heroDot, { backgroundColor: Colors.danger }]} />
              <Text style={styles.heroMetricValue}>{inactiveCount}</Text>
              <Text style={styles.heroMetricLabel}>Inactive</Text>
            </View>
            <View style={styles.heroMetricSep} />
            <View style={styles.heroMetric}>
              <View style={[styles.heroDot, { backgroundColor: Colors.accent }]} />
              <Text style={styles.heroMetricValue}>
                {staffList.length > 0 ? Math.round((activeCount / staffList.length) * 100) : 0}%
              </Text>
              <Text style={styles.heroMetricLabel}>Active Rate</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ── Section header ─────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Team Members</Text>
        <Text style={styles.sectionCount}>{staffList.length} members</Text>
      </View>
    </>
  );

  const ListFooter = (
    <>
      {/* Date filter indicator */}
      <View style={styles.filterIndicator}>
        <View style={styles.filterBadge}>
          <Ionicons name="time-outline" size={13} color={Colors.primary} />
          <Text style={styles.filterBadgeText}>{showAll ? 'All time' : 'Past 2 days'}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAll((v) => !v)}>
          <Text style={styles.filterToggle}>{showAll ? 'Show recent only' : 'Show all'}</Text>
        </TouchableOpacity>
      </View>

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.paginationBar}>
          <TouchableOpacity onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}>
            <Ionicons name="chevron-back" size={16} color={page <= 1 ? Colors.textSecondary : Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.pageLabel}>Page {page} of {totalPages}</Text>
          <TouchableOpacity onPress={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}>
            <Ionicons name="chevron-forward" size={16} color={page >= totalPages ? Colors.textSecondary : Colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {staffList.length > 0 && (
        <TouchableOpacity style={styles.promoBanner} activeOpacity={0.8}>
          <View style={styles.promoIcon}>
            <Ionicons name="shield-checkmark-outline" size={22} color={Colors.primary} />
          </View>
          <View style={styles.promoText}>
            <Text style={styles.promoTitle}>Secure & Controlled Access</Text>
            <Text style={styles.promoSubtitle}>Control what each staff member can see and do.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <Animated.View entering={FadeIn.duration(Motion.duration.slow)} style={styles.container}>
      <StatusBar style="dark" />
      {/* ── Page header ───────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View>
          <Text style={styles.title}>Staff</Text>
          <Text style={styles.subtitle}>Manage your team and their access</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.8}
          onPress={() => router.push('/(owner)/staff/new')}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add Staff</Text>
        </TouchableOpacity>
      </View>

      <ContextualSearchBar
        value={searchValue}
        onChangeText={onSearchChange}
        onSubmit={onSearchSubmit}
        recentSearches={recentSearches}
        onSelectRecent={selectRecent}
        onClearRecent={clearRecent}
        placeholder="Search staff by name or email…"
        style={styles.searchBar}
      />

      <FlatList
        showsVerticalScrollIndicator={false}
        data={staffList}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <StaffCard
            staff={item}
            onPress={() => router.push(`/(owner)/staff/${item._id}`)}
          />
        )}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: tabBarHeight + Spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListEmptyComponent={<EmptyState title="No staff found" subtitle="Add a team member to get started." />}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: { marginHorizontal: Spacing.lg, marginBottom: Spacing.xs },

  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addBtnText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#FFFFFF',
  },

  // ── Hero card
  heroWrapper: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    borderRadius: 20,
    shadowColor: '#0A2318',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  heroCard: {
    borderRadius: 20,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  heroDecorCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.04)',
    right: -30,
    top: -50,
  },
  heroDecorCircleSmall: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.05)',
    left: -20,
    bottom: -20,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  heroLeft: {
    gap: 4,
  },
  heroLabel: {
    fontSize: Typography.size.caption,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: Typography.fontFamily,
    letterSpacing: 0.3,
  },
  heroValue: {
    fontSize: 36,
    fontFamily: Typography.fontFamilyBold,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Typography.fontFamily,
  },
  heroRight: {
    paddingTop: 2,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: Spacing.md,
  },
  heroMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  heroMetricValue: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#FFFFFF',
  },
  heroMetricLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Typography.fontFamily,
  },
  heroMetricSep: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // ── Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  sectionCount: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
  },

  // ── Promo banner
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  promoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoText: { flex: 1 },
  promoTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    marginBottom: 2,
  },
  promoSubtitle: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  filterIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  filterBadgeText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  filterToggle: {
    fontSize: 12,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: Spacing.lg,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    borderColor: Colors.border,
  },
  pageLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
});
