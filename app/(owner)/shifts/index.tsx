import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { getShifts, type Shift } from '@/services/shifts';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const staffName = (shift: Shift) =>
  typeof shift.staff === 'object' ? shift.staff.name : 'Staff';

const duration = (shift: Shift) => {
  const mins = shift.summary?.durationMinutes;
  if (mins == null) return null;
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const DiscrepancyBadge: React.FC<{ value: number | null | undefined }> = ({ value }) => {
  if (value == null) return null;
  const balanced = value === 0;
  const over = value > 0;
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: balanced ? Colors.successSubtle : over ? '#DBEAFE' : Colors.dangerSubtle },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color: balanced ? Colors.success : over ? Colors.info : Colors.danger },
        ]}
      >
        {balanced ? 'Balanced' : over ? `Over ${formatCurrency(value)}` : `Short ${formatCurrency(Math.abs(value))}`}
      </Text>
    </View>
  );
};

export default function ShiftsList() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['shifts', page],
    queryFn: () => getShifts({ page, limit: 10 }),
  });

  const shifts = data?.data ?? [];
  const totalPages = data?.pagination?.pages ?? 1;

  if (isLoading) return <ListSkeleton />;

  return (
    <FlashList
      data={shifts}
      estimatedItemSize={100}
      keyExtractor={(item) => item._id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} colors={[Colors.primary]} />
      }
      ListEmptyComponent={
        <EmptyState title="No shifts yet" subtitle="Shift sessions will appear here once staff start clocking in." />
      }
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInUp.duration(350).delay(Math.min(index, 6) * 50)}>
          <AnimatedPressable
            onPress={() => router.push(`/(owner)/shifts/${item._id}`)}
            pressScale={0.98}
            style={styles.card}
            accessibilityRole="button"
          >
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={15} color={Colors.primary} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.name}>{staffName(item)}</Text>
                <Text style={styles.meta}>
                  {formatDateTime(item.startedAt)}
                  {duration(item) ? ` · ${duration(item)}` : ''}
                </Text>
              </View>
              {item.status === 'active' ? (
                <View style={[styles.badge, { backgroundColor: Colors.primarySubtle }]}>
                  <Text style={[styles.badgeText, { color: Colors.primary }]}>ACTIVE</Text>
                </View>
              ) : (
                <DiscrepancyBadge value={item.summary?.cashDiscrepancy} />
              )}
            </View>
            {item.summary ? (
              <View style={styles.statsRow}>
                <Text style={styles.stat}>
                  <Text style={styles.statValue}>{item.summary.salesCount}</Text> sales
                </Text>
                <Text style={styles.stat}>
                  <Text style={styles.statValue}>{formatCurrency(item.summary.grossSales)}</Text> total
                </Text>
                <Text style={styles.stat}>
                  <Text style={styles.statValue}>{formatCurrency(item.summary.byMethod.cash.total)}</Text> cash
                </Text>
              </View>
            ) : null}
          </AnimatedPressable>
        </Animated.View>
      )}
      ListFooterComponent={
        totalPages > 1 ? (
          <View style={styles.pagination}>
            <AnimatedPressable
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Previous page"
            >
              <Ionicons name="chevron-back" size={16} color={page <= 1 ? Colors.textTertiary : Colors.primary} />
            </AnimatedPressable>
            <Text style={styles.pageLabel}>Page {page} of {totalPages}</Text>
            <AnimatedPressable
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Next page"
            >
              <Ionicons name="chevron-forward" size={16} color={page >= totalPages ? Colors.textTertiary : Colors.primary} />
            </AnimatedPressable>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: { flex: 1 },
  name: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  stat: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  statValue: {
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  pageBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: { opacity: 0.5 },
  pageLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
});
