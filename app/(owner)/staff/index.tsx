import React, { useState } from 'react';
import { View, RefreshControl, StyleSheet, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { CrossfadeCircle } from '@/components/ui/motion';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getStaff } from '@/services/staff';
import { useStaffDeletionRequests } from '@/hooks/useStaffDeletionRequests';
import { formatDate as formatRequestDate } from '@/utils/formatters';
import { StaffCard } from '@/components/staff/StaffCard';
import { ContextualSearchBar } from '@/components/ui/ContextualSearchBar';
import { useSearch } from '@/hooks/useSearch';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';
import { QueryError } from '@/components/ui/QueryError';

export default function OwnerStaffList() {
  const tabBarHeight = useTabBarHeight();
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

  // Page is stored together with the term it belongs to, so a new search
  // *derives* page 1 rather than setting it from an effect — the effect version
  // rendered page 2 of the new term once before correcting itself, which is the
  // cascading render react-hooks/set-state-in-effect flags.
  const [paging, setPaging] = useState({ term: searchQuery, page: 1 });
  const page = paging.term === searchQuery ? paging.page : 1;
  const setPage = (next: number | ((current: number) => number)) =>
    setPaging({ term: searchQuery, page: typeof next === 'function' ? next(page) : next });

  const { data, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['staff', searchQuery, page],
    queryFn: () => getStaff({ search: searchQuery, page, limit: 10 }),
    // Keep the current team list mounted while a new search/page loads,
    // instead of the whole screen dropping to a skeleton.
    placeholderData: keepPreviousData,
  });

  // Independent of the paginated/searched list: a request must not disappear
  // from view just because the owner typed something in the search box.
  const { data: deletionRequestData } = useStaffDeletionRequests();
  const deletionRequests = deletionRequestData?.data ?? [];
  const approvalWindowDays = deletionRequestData?.meta?.approvalWindowDays;

  const staffList = data?.data || [];
  const totalPages = data?.pagination?.pages ?? 1;
  const activeCount = staffList.filter((s) => s.isActive).length;
  const inactiveCount = staffList.filter((s) => !s.isActive).length;

  if (isLoading && staffList.length === 0 && !searchQuery) {
    return <ListSkeleton rows={5} heroHeight={160} showSearch />;
  }

  if (isError && staffList.length === 0) {
    return <QueryError onRetry={refetch} />;
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
          <CrossfadeCircle phase="in" style={styles.heroDecorCircle} />
          <CrossfadeCircle phase="out" style={styles.heroDecorCircleSmall} />

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

      {/* ── Pending account-closure requests ───────────────────────── */}
      {/* Unanswered requests go through on their own after the approval
          window, so they need to be visible without opening each profile. */}
      {deletionRequests.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.requestsBanner}>
          <View style={styles.requestsHeader}>
            <Ionicons name="person-remove-outline" size={16} color={Colors.warning} />
            <Text style={styles.requestsTitle}>
              {deletionRequests.length === 1
                ? '1 account closure request'
                : `${deletionRequests.length} account closure requests`}
            </Text>
          </View>
          {!!approvalWindowDays && (
            <Text style={styles.requestsHint}>
              Requests you don&apos;t answer within {approvalWindowDays} days go ahead on their own.
            </Text>
          )}
          {deletionRequests.map((request) => (
            <AnimatedPressable
              key={request._id}
              style={styles.requestRow}
              onPress={() => router.push(`/(owner)/staff/${request._id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Review ${request.name}'s account closure request`}
            >
              <View style={styles.requestText}>
                <Text style={styles.requestName} numberOfLines={1}>{request.name}</Text>
                <Text style={styles.requestMeta} numberOfLines={1}>
                  Approves on its own by {formatRequestDate(request.autoApprovesAt)}
                </Text>
              </View>
              <Text style={styles.requestAction}>Review</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </AnimatedPressable>
          ))}
        </Animated.View>
      )}

      {/* ── Section header ─────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Team Members</Text>
        <Text style={styles.sectionCount}>{staffList.length} members</Text>
      </View>
    </>
  );

  const ListFooter = (
    <>
      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.paginationBar}>
          <AnimatedPressable onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}>
            <Ionicons name="chevron-back" size={16} color={page <= 1 ? Colors.textSecondary : Colors.primary} />
          </AnimatedPressable>
          <Text style={styles.pageLabel}>Page {page} of {totalPages}</Text>
          <AnimatedPressable onPress={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}>
            <Ionicons name="chevron-forward" size={16} color={page >= totalPages ? Colors.textSecondary : Colors.primary} />
          </AnimatedPressable>
        </View>
      )}

      {staffList.length > 0 && (
        <View style={styles.promoBanner}>
          <View style={styles.promoIcon}>
            <Ionicons name="shield-checkmark-outline" size={22} color={Colors.primary} />
          </View>
          <View style={styles.promoText}>
            <Text style={styles.promoTitle}>Secure & Controlled Access</Text>
            <Text style={styles.promoSubtitle}>Tap a staff member to manage their permissions.</Text>
          </View>
        </View>
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
        <AnimatedPressable
          style={styles.addBtn}
          onPress={() => router.push('/(owner)/staff/new')}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add Staff</Text>
        </AnimatedPressable>
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

      <FlashList
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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
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

  // ── Pending closure requests
  requestsBanner: {
    backgroundColor: Colors.warningSubtle,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  requestsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requestsHint: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: -2,
  },
  requestsTitle: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    minHeight: 48,
  },
  requestText: { flex: 1, gap: 2 },
  requestName: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  requestMeta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  requestAction: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
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
