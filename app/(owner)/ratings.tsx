/**
 * Customer Reviews — the written side of the star ratings the reports screen
 * only ever summarised. Owners come here to read what people actually said,
 * so the comment is the row's headline and the metadata sits under it.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { haptics } from '@/utils/haptics';
import { getRatings, getRatingsSummary, type Rating, type RatingsSummary } from '@/services/ratings';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { formatCurrency, formatRelativeTime } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

// ─── filters ──────────────────────────────────────────────────────────────────

type Filter = 'all' | 'comments' | '5' | '4' | '3' | '2' | '1';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'comments', label: 'With comments' },
  { value: '5', label: '5 ★' },
  { value: '4', label: '4 ★' },
  { value: '3', label: '3 ★' },
  { value: '2', label: '2 ★' },
  { value: '1', label: '1 ★' },
];

const paramsFor = (filter: Filter) => {
  if (filter === 'all') return {};
  if (filter === 'comments') return { hasComment: true };
  return { stars: Number(filter) };
};

// ─── small pieces ─────────────────────────────────────────────────────────────

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <View style={s.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(value) ? 'star' : 'star-outline'}
          size={size}
          color={i <= Math.round(value) ? Colors.warning : Colors.border}
        />
      ))}
    </View>
  );
}

function StatTile({
  icon,
  tint,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: string;
  label: string;
}) {
  return (
    <View style={s.tile}>
      <View style={[s.tileIcon, { backgroundColor: `${tint}18` }]}>
        <Ionicons name={icon} size={14} color={tint} />
      </View>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function TrendLine({ summary }: { summary: RatingsSummary }) {
  const recent = summary.last30Days;
  const previous = summary.previous30Days;
  // Older backends don't send the windows at all; comparing against a month
  // with no ratings would be noise rather than a trend.
  if (!recent || !previous || recent.totalRatings === 0 || previous.totalRatings === 0) return null;

  const delta = recent.avgStars - previous.avgStars;
  const flat = Math.abs(delta) < 0.05;
  const up = delta > 0;
  const color = flat ? Colors.textTertiary : up ? Colors.success : Colors.danger;

  return (
    <View style={s.trendRow}>
      <Ionicons
        name={flat ? 'remove-outline' : up ? 'trending-up' : 'trending-down'}
        size={13}
        color={color}
      />
      <Text style={s.trendText}>
        {flat ? 'Holding steady' : `${up ? 'Up' : 'Down'} ${Math.abs(delta).toFixed(1)}`}
        {' vs the previous 30 days · '}
        <Text style={s.trendStrong}>{recent.totalRatings}</Text>
        {' review'}{recent.totalRatings === 1 ? '' : 's'} this month
      </Text>
    </View>
  );
}

function DistributionRow({
  stars,
  count,
  total,
  active,
  onPress,
}: {
  stars: number;
  count: number;
  total: number;
  active: boolean;
  onPress: () => void;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <AnimatedPressable
      onPress={onPress}
      // A bar with nothing behind it would filter to an empty list.
      disabled={count === 0}
      pressScale={0.99}
      style={s.distRow}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: count === 0 }}
      accessibilityLabel={`${stars} star reviews: ${count}`}
    >
      <Text style={[s.distLabel, active && s.distLabelActive]}>{stars}★</Text>
      <View style={s.distTrack}>
        <View style={[s.distFill, { width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }]} />
      </View>
      <Text style={[s.distCount, active && s.distLabelActive]}>{count}</Text>
    </AnimatedPressable>
  );
}

// ─── review row ───────────────────────────────────────────────────────────────

const staffNameOf = (r: Rating) => (typeof r.staff === 'object' && r.staff ? r.staff.name : 'Staff');
const saleOf = (r: Rating) => (typeof r.sale === 'object' && r.sale ? r.sale : null);

function ReviewCard({ rating, currency }: { rating: Rating; currency?: string }) {
  const sale = saleOf(rating);
  const hasComment = !!rating.comment?.trim();

  return (
    <View style={[s.review, Shadows.sm]}>
      <View style={s.reviewTop}>
        <Stars value={rating.stars} />
        <Text style={s.reviewWhen}>{formatRelativeTime(rating.createdAt)}</Text>
      </View>

      {hasComment ? (
        <Text style={s.comment}>{rating.comment!.trim()}</Text>
      ) : (
        <Text style={s.noComment}>Rated without leaving a comment</Text>
      )}

      <View style={s.reviewFoot}>
        <Ionicons name="person-circle-outline" size={15} color={Colors.textTertiary} />
        <Text style={s.footText} numberOfLines={1}>
          {staffNameOf(rating)}
          {sale ? ` · ${sale.invoiceNumber}` : ''}
        </Text>
        {sale ? (
          <Text style={s.footAmount}>{formatCurrency(sale.totalAmount, currency)}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function CustomerReviews() {
  const tabBarHeight = useTabBarHeight();
  const currency = useAuthStore((st: AuthState) => st.user?.shop?.currency);
  const [filter, setFilter] = useState<Filter>('all');

  const { data: summaryData, refetch: refetchSummary } = useQuery({
    queryKey: ['ratingsSummary'],
    queryFn: getRatingsSummary,
  });
  const summary = summaryData?.data;

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['ratings', filter],
    queryFn: ({ pageParam }) => getRatings({ page: pageParam, limit: 20, ...paramsFor(filter) }),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
    // Keep showing the previous filter's reviews while the new one loads,
    // instead of the whole screen dropping to a skeleton on every chip tap.
    placeholderData: keepPreviousData,
  });

  const reviews = data?.pages.flatMap((p) => p.data) ?? [];
  const total = summary?.totalRatings ?? 0;
  const distribution = summary?.distribution ?? [];
  const countFor = (stars: number) => distribution.find((d) => d.stars === stars)?.count ?? 0;

  const select = (next: Filter) => {
    haptics.light();
    setFilter(next);
  };

  if (isLoading && reviews.length === 0) return <ListSkeleton rows={5} heroHeight={190} />;

  return (
    <FlashList
      data={reviews}
      keyExtractor={(item) => item._id}
      showsVerticalScrollIndicator={false}
      onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
      onEndReachedThreshold={0.4}
      contentContainerStyle={{ padding: Spacing.md, paddingBottom: tabBarHeight + Spacing.xl }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => { refetch(); refetchSummary(); }}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
      ListHeaderComponent={
        <View>
          {total > 0 && summary ? (
            <>
              {/* score + distribution */}
              <View style={[s.scoreCard, Shadows.sm]}>
                <View style={s.scoreLeft}>
                  <Text style={s.scoreNum}>{summary.avgStars.toFixed(1)}</Text>
                  <Stars value={summary.avgStars} size={12} />
                  <Text style={s.scoreTotal}>
                    {total} review{total === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={s.scoreRight}>
                  {[5, 4, 3, 2, 1].map((stars) => (
                    <DistributionRow
                      key={stars}
                      stars={stars}
                      count={countFor(stars)}
                      total={total}
                      active={filter === String(stars)}
                      onPress={() => select(filter === String(stars) ? 'all' : (String(stars) as Filter))}
                    />
                  ))}
                </View>
              </View>

              <TrendLine summary={summary} />

              {/* headline stats */}
              <View style={s.tileRow}>
                <StatTile
                  icon="chatbubble-ellipses-outline"
                  tint={Colors.primary}
                  value={String(summary.withComments ?? 0)}
                  label="Written comments"
                />
                <StatTile
                  icon="happy-outline"
                  tint={Colors.success}
                  value={String(summary.positiveCount ?? 0)}
                  label="Happy (4–5★)"
                />
                <StatTile
                  icon="alert-circle-outline"
                  tint={Colors.danger}
                  value={String(summary.negativeCount ?? 0)}
                  label="Needs attention (1–2★)"
                />
              </View>

              {/* filters */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.chipScroll}
                contentContainerStyle={s.chipRow}
              >
                {FILTERS.map((f) => {
                  const active = filter === f.value;
                  return (
                    <AnimatedPressable
                      key={f.value}
                      onPress={() => select(f.value)}
                      style={[s.chip, active && s.chipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
                    </AnimatedPressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}
        </View>
      }
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInUp.duration(280).delay(index < 8 ? index * 35 : 0)}>
          <ReviewCard rating={item} currency={currency} />
        </Animated.View>
      )}
      ListEmptyComponent={
        // Keyed off the filter, not the summary: the summary is a separate
        // request and must never decide whether "no reviews" is the truth.
        filter === 'all' ? (
          <EmptyState
            title="No reviews yet"
            subtitle="Customers rate their visit from the receipt QR code. Share a receipt to collect your first review."
          />
        ) : (
          <EmptyState
            title="Nothing matches this filter"
            subtitle="Try another star rating, or switch back to All."
          />
        )
      }
      ListFooterComponent={
        isFetchingNextPage ? <Text style={s.loadingMore}>Loading more…</Text> : null
      }
    />
  );
}

const s = StyleSheet.create({
  starsRow: { flexDirection: 'row', gap: 2 },

  // score card
  scoreCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  scoreLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingRight: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
    minWidth: 96,
  },
  scoreNum: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  scoreTotal: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },
  scoreRight: { flex: 1, justifyContent: 'center', gap: 5 },

  // distribution
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    width: 22,
  },
  distLabelActive: { color: Colors.primary },
  distTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  distFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.warning },
  distCount: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    width: 26,
    textAlign: 'right',
  },

  // trend
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  trendText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  trendStrong: { fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },

  // stat tiles
  tileRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: 2,
  },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileValue: {
    fontSize: 18,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  tileLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    lineHeight: 14,
  },

  // filter chips
  chipScroll: { marginHorizontal: -Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.sm },
  chipRow: { gap: Spacing.sm, paddingHorizontal: Spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  chipTextActive: { color: Colors.white },

  // review card
  review: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  reviewWhen: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },
  comment: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
    lineHeight: 21,
    marginTop: Spacing.sm,
  },
  noComment: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
  reviewFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  footText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  footAmount: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },

  loadingMore: {
    textAlign: 'center',
    paddingVertical: Spacing.md,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },
});
