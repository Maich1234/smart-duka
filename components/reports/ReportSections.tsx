/**
 * Premium report sections: insights carousel, quick shortcuts, top products
 * leaderboard, staff performance, customer ratings, and stock intelligence.
 * All sections source their own styling and require no external Card/Section
 * primitives so the visual hierarchy can be fully bespoke.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, { Rect, Text as SvgText, Line as SvgLine } from 'react-native-svg';
import type { ReportSummary, TopProduct, StaffPerformance, ReportPeriod, ReportBucket } from '@/services/reports';
import type { RatingsSummary } from '@/services/ratings';
import type { DepletionAnalytics } from '@/services/analytics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';
import { formatCurrency } from '@/utils/formatters';

// ─── shared primitives ────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
  delay = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(320).delay(delay)} style={sh.container}>
      <View style={sh.iconWrap}>
        <Ionicons name={icon} size={15} color={Colors.primary} />
      </View>
      <View>
        <Text style={sh.title}>{title}</Text>
        {subtitle && <Text style={sh.subtitle}>{subtitle}</Text>}
      </View>
    </Animated.View>
  );
}

const sh = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginTop: 1,
  },
});

function EmptyCard({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={ec.card}>
      <View style={ec.iconWrap}>
        <Ionicons name={icon} size={24} color={Colors.textTertiary} />
      </View>
      <Text style={ec.title}>{title}</Text>
      <Text style={ec.body}>{body}</Text>
    </View>
  );
}

const ec = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  body: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 240,
  },
});

// ─── InsightCards ─────────────────────────────────────────────────────────────

interface InsightItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
}

function buildInsights(
  summary: ReportSummary,
  series: ReportBucket[],
  currency: string | undefined,
  period: ReportPeriod,
): InsightItem[] {
  const items: InsightItem[] = [];

  // Peak period
  const peak = series.reduce(
    (best, b) => (b.total > best.total ? b : best),
    series[0] ?? { total: 0, label: '' },
  );
  if (peak && peak.total > 0) {
    items.push({
      id: 'peak',
      icon: 'flame-outline',
      bg: '#FFF4EE',
      iconColor: '#E4612F',
      label: 'Peak',
      value: peak.label,
      sub: formatCurrency(peak.total, currency),
    });
  }

  // Profit margin
  if (summary.totalRevenue > 0) {
    const margin = (summary.netProfit / summary.totalRevenue) * 100;
    items.push({
      id: 'margin',
      icon: margin >= 0 ? 'trending-up-outline' : 'trending-down-outline',
      bg: margin >= 0 ? Colors.successSubtle : Colors.dangerSubtle,
      iconColor: margin >= 0 ? Colors.success : Colors.danger,
      label: 'Net Margin',
      value: `${Math.abs(margin).toFixed(1)}%`,
      sub: margin >= 0 ? 'Profitable' : 'Review costs',
    });
  }

  // Payment dominance
  if (summary.totalRevenue > 0) {
    const cashPct = (summary.cashTotal / summary.totalRevenue) * 100;
    const dominant = cashPct >= 50 ? 'Cash' : 'M-Pesa';
    const pct = cashPct >= 50 ? cashPct : 100 - cashPct;
    items.push({
      id: 'payment',
      icon: 'wallet-outline',
      bg: '#EFF6FF',
      iconColor: Colors.info,
      label: 'Top Method',
      value: dominant,
      sub: `${pct.toFixed(0)}% of revenue`,
    });
  }

  // Expense burden
  if (summary.expenseTotal > 0 && summary.totalRevenue > 0) {
    const ratio = (summary.expenseTotal / summary.totalRevenue) * 100;
    items.push({
      id: 'expenses',
      icon: 'card-outline',
      bg: Colors.warningSubtle,
      iconColor: Colors.warning,
      label: 'Expenses',
      value: formatCurrency(summary.expenseTotal, currency),
      sub: `${ratio.toFixed(0)}% of revenue`,
    });
  }

  // Average transaction
  if (summary.totalTransactions > 0) {
    items.push({
      id: 'avg',
      icon: 'calculator-outline',
      bg: Colors.primarySubtle,
      iconColor: Colors.primary,
      label: 'Avg. Sale',
      value: formatCurrency(summary.averageSale, currency),
      sub: `${summary.totalTransactions} transactions`,
    });
  }

  return items;
}

interface InsightCardsProps {
  summary: ReportSummary;
  series: ReportBucket[];
  currency?: string;
  period: ReportPeriod;
}

export function InsightCards({ summary, series, currency, period }: InsightCardsProps) {
  const items = buildInsights(summary, series, currency, period);
  if (items.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.duration(380).delay(200)}>
      <SectionHeader icon="bulb-outline" title="Quick Insights" delay={180} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ins.scroll}
      >
        {items.map((item, i) => (
          <View key={item.id} style={[ins.card, Shadows.sm]}>
            <View style={[ins.iconWrap, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={16} color={item.iconColor} />
            </View>
            <Text style={ins.label}>{item.label}</Text>
            <Text style={ins.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {item.value}
            </Text>
            <Text style={ins.sub} numberOfLines={1}>{item.sub}</Text>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const ins = StyleSheet.create({
  scroll: {
    gap: Spacing.sm,
    paddingRight: Spacing.xs,
    paddingBottom: 2,
  },
  card: {
    width: 150,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 3,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
});

// ─── QuickShortcuts ───────────────────────────────────────────────────────────

const SHORTCUTS = [
  {
    id: 'expenses',
    label: 'Expenses',
    sub: 'Track costs',
    icon: 'cash-outline' as const,
    colors: ['#0F766E', '#14B8A6'] as [string, string],
    route: '/(owner)/expenses',
  },
  {
    id: 'sales',
    label: 'All Sales',
    sub: 'View history',
    icon: 'cart-outline' as const,
    colors: ['#1D4ED8', '#3B82F6'] as [string, string],
    route: '/(owner)/sales',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    sub: 'Manage stock',
    icon: 'cube-outline' as const,
    colors: ['#7C3AED', '#A78BFA'] as [string, string],
    route: '/(owner)/inventory',
  },
  {
    id: 'staff',
    label: 'My Staff',
    sub: 'Team overview',
    icon: 'people-outline' as const,
    colors: ['#C8932A', '#E0AC4C'] as [string, string],
    route: '/(owner)/staff',
  },
] as const;

export function QuickShortcuts() {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(260)}>
      <SectionHeader icon="grid-outline" title="Quick Access" delay={240} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={qs.scroll}
      >
        {SHORTCUTS.map((s) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => router.push(s.route as never)}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={s.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[qs.card, Shadows.sm]}
            >
              <View style={qs.iconWrap}>
                <Ionicons name={s.icon} size={20} color="rgba(255,255,255,0.9)" />
              </View>
              <Text style={qs.label}>{s.label}</Text>
              <Text style={qs.sub}>{s.sub}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const qs = StyleSheet.create({
  scroll: {
    gap: Spacing.sm,
    paddingRight: Spacing.xs,
    paddingBottom: 2,
  },
  card: {
    width: 128,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 3,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.white,
    letterSpacing: -0.1,
  },
  sub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: Typography.fontFamily,
  },
});

// ─── TopProductsLeaderboard ───────────────────────────────────────────────────

const RANK_STYLES = [
  { bg: '#FEF3C7', fg: Colors.accent, label: '1' },
  { bg: '#F1F5F9', fg: Colors.textSecondary, label: '2' },
  { bg: '#FBF1DD', fg: '#9C6F1E', label: '3' },
] as const;

interface TopProductsProps {
  products: TopProduct[];
  currency?: string;
}

export function TopProductsLeaderboard({ products, currency }: TopProductsProps) {
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);

  return (
    <Animated.View entering={FadeInDown.duration(380).delay(320)}>
      <SectionHeader
        icon="trophy-outline"
        title="Top Products"
        subtitle="Ranked by revenue generated"
        delay={300}
      />
      {products.length === 0 ? (
        <EmptyCard
          icon="bag-outline"
          title="No product sales yet"
          body="Start selling to see your top-performing products ranked here."
        />
      ) : (
        <View style={[tp.card, Shadows.sm]}>
          {products.map((p, i) => {
            const pct = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
            const rank = RANK_STYLES[i] ?? { bg: Colors.divider, fg: Colors.textSecondary, label: `${i + 1}` };
            const isLast = i === products.length - 1;
            return (
              <View key={p.productName} style={[tp.row, !isLast && tp.rowBorder]}>
                {/* rank badge */}
                <View style={[tp.rankBadge, { backgroundColor: rank.bg }]}>
                  <Text style={[tp.rankText, { color: rank.fg }]}>{rank.label}</Text>
                </View>

                {/* product info */}
                <View style={tp.info}>
                  <Text style={tp.name} numberOfLines={1}>{p.productName}</Text>
                  <View style={tp.barRow}>
                    <View style={tp.barTrack}>
                      <View style={[tp.barFill, { width: `${Math.max(pct, 2)}%` }]} />
                    </View>
                    <Text style={tp.pctLabel}>{pct.toFixed(0)}%</Text>
                  </View>
                </View>

                {/* right side */}
                <View style={tp.right}>
                  <Text style={tp.revenue}>{formatCurrency(p.revenue, currency)}</Text>
                  <Text style={tp.units}>{p.quantitySold} sold</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

const tp = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankText: {
    fontSize: 12,
    fontFamily: Typography.fontFamilyBold,
  },
  info: {
    flex: 1,
    gap: 5,
  },
  name: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  pctLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamilySemiBold,
    width: 26,
    textAlign: 'right',
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  revenue: {
    fontSize: 13,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  units: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
});

// ─── StaffPerformanceSection ──────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#D1FAE5', fg: '#065F46' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#EDE9FE', fg: '#5B21B6' },
];

function avatarColor(name: string) {
  const idx = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

interface StaffSectionProps {
  staff: StaffPerformance[];
  currency?: string;
}

export function StaffPerformanceSection({ staff, currency }: StaffSectionProps) {
  const totalSales = staff.reduce((s, m) => s + m.total, 0);

  return (
    <Animated.View entering={FadeInDown.duration(380).delay(380)}>
      <SectionHeader
        icon="people-outline"
        title="Staff Performance"
        subtitle="Sales contribution by team member"
        delay={360}
      />
      {staff.length === 0 ? (
        <EmptyCard
          icon="person-outline"
          title="No staff sales recorded"
          body="Staff-attributed sales will appear here once team members start selling."
        />
      ) : (
        <View style={[sp.card, Shadows.sm]}>
          {staff.map((m, i) => {
            const av = avatarColor(m.staffName);
            const pct = totalSales > 0 ? (m.total / totalSales) * 100 : 0;
            const avgTxn = m.transactionCount > 0 ? m.total / m.transactionCount : 0;
            const isLast = i === staff.length - 1;
            return (
              <View key={m.staffName} style={[sp.row, !isLast && sp.rowBorder]}>
                {/* rank dot */}
                <View style={sp.rankDot}>
                  <Text style={sp.rankNum}>{i + 1}</Text>
                </View>

                {/* avatar */}
                <View style={[sp.avatar, { backgroundColor: av.bg }]}>
                  <Text style={[sp.avatarText, { color: av.fg }]}>{initials(m.staffName)}</Text>
                </View>

                {/* info */}
                <View style={sp.info}>
                  <Text style={sp.name} numberOfLines={1}>{m.staffName}</Text>
                  <Text style={sp.meta}>
                    {m.transactionCount} sales · avg {formatCurrency(avgTxn, currency)}
                  </Text>
                </View>

                {/* stats */}
                <View style={sp.right}>
                  <Text style={sp.total}>{formatCurrency(m.total, currency)}</Text>
                  <Text style={sp.share}>{pct.toFixed(0)}% share</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

const sp = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rankDot: {
    width: 18,
    alignItems: 'center',
  },
  rankNum: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 13,
    fontFamily: Typography.fontFamilyBold,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  total: {
    fontSize: 13,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  share: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
});

// ─── RatingsModule ────────────────────────────────────────────────────────────

function StarRow({ count, total }: { count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={rm.starRow}>
      <View style={rm.starTrack}>
        <View style={[rm.starFill, { width: `${Math.max(pct, 1)}%` }]} />
      </View>
      <Text style={rm.starPct}>{pct.toFixed(0)}%</Text>
    </View>
  );
}

interface RatingsProps {
  ratings: RatingsSummary | null | undefined;
}

export function RatingsModule({ ratings }: RatingsProps) {
  const hasData = ratings && ratings.totalRatings > 0;

  const sentiment =
    !ratings ? '' :
    ratings.avgStars >= 4.5 ? 'Excellent' :
    ratings.avgStars >= 4 ? 'Very Good' :
    ratings.avgStars >= 3 ? 'Good' :
    ratings.avgStars >= 2 ? 'Fair' : 'Needs work';

  return (
    <Animated.View entering={FadeInDown.duration(380).delay(440)}>
      <SectionHeader
        icon="star-outline"
        title="Customer Ratings"
        subtitle="How customers rate their experience"
        delay={420}
      />
      {!hasData ? (
        <EmptyCard
          icon="chatbubble-outline"
          title="No ratings yet"
          body="Customers can rate their experience after each sale. Share your receipt QR code to collect feedback."
        />
      ) : (
        <View style={[rm.card, Shadows.sm]}>
          {/* score headline */}
          <View style={rm.scoreRow}>
            <View style={rm.scoreLeft}>
              <Text style={rm.scoreNum}>{ratings!.avgStars.toFixed(1)}</Text>
              <Text style={rm.sentiment}>{sentiment}</Text>
            </View>
            <View style={rm.scoreRight}>
              {/* star icons */}
              <View style={rm.stars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons
                    key={s}
                    name={s <= Math.round(ratings!.avgStars) ? 'star' : 'star-outline'}
                    size={16}
                    color={Colors.warning}
                  />
                ))}
              </View>
              <Text style={rm.totalRatings}>{ratings!.totalRatings} reviews</Text>

              {/* distribution bars */}
              <View style={rm.distribution}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const bucket = ratings!.distribution?.find((d) => d.stars === star);
                  return (
                    <View key={star} style={rm.distRow}>
                      <Text style={rm.distLabel}>{star}★</Text>
                      <StarRow count={bucket?.count ?? 0} total={ratings!.totalRatings} />
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* per-staff breakdown */}
          {ratings!.byStaff.length > 0 && (
            <>
              <View style={rm.divider} />
              {ratings!.byStaff.map((s, i) => {
                const av = avatarColor(s.staffName);
                const isLast = i === ratings!.byStaff.length - 1;
                return (
                  <View key={s.staffId} style={[rm.staffRow, !isLast && rm.staffBorder]}>
                    <View style={[rm.staffAvatar, { backgroundColor: av.bg }]}>
                      <Text style={[rm.staffInit, { color: av.fg }]}>{initials(s.staffName)}</Text>
                    </View>
                    <View style={rm.staffInfo}>
                      <Text style={rm.staffName}>{s.staffName}</Text>
                      <Text style={rm.staffRatingCount}>{s.totalRatings} ratings</Text>
                    </View>
                    <View style={rm.staffScore}>
                      <Text style={rm.staffAvg}>{s.avgStars.toFixed(1)}</Text>
                      <Ionicons name="star" size={11} color={Colors.warning} />
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const rm = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  scoreRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  scoreLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
    minWidth: 72,
  },
  scoreNum: {
    fontSize: 44,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 50,
  },
  sentiment: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.warning,
    textAlign: 'center',
    marginTop: 2,
  },
  scoreRight: {
    flex: 1,
    gap: 6,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  totalRatings: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
  distribution: {
    gap: 4,
    marginTop: 2,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamilySemiBold,
    width: 22,
  },
  starRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starTrack: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.divider,
    borderRadius: 3,
    overflow: 'hidden',
  },
  starFill: {
    height: '100%',
    backgroundColor: Colors.warning,
    borderRadius: 3,
  },
  starPct: {
    fontSize: 9,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamilySemiBold,
    width: 24,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 10,
  },
  staffBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  staffAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffInit: {
    fontSize: 12,
    fontFamily: Typography.fontFamilyBold,
  },
  staffInfo: {
    flex: 1,
    gap: 2,
  },
  staffName: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  staffRatingCount: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
  staffScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  staffAvg: {
    fontSize: 15,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
});

// ─── StockIntelligence ────────────────────────────────────────────────────────

interface StockIntelligenceProps {
  depletion: DepletionAnalytics | null | undefined;
}

export function StockIntelligence({ depletion }: StockIntelligenceProps) {
  const hasData =
    depletion &&
    (depletion.fastMovers.length > 0 || depletion.slowMovers.length > 0);

  return (
    <Animated.View entering={FadeInDown.duration(380).delay(500)}>
      <SectionHeader
        icon="speedometer-outline"
        title="Stock Intelligence"
        subtitle="Inventory velocity and stockout risk"
        delay={480}
      />
      {!hasData ? (
        <EmptyCard
          icon="analytics-outline"
          title="Not enough history yet"
          body="Stock velocity analysis becomes available after a few days of sales data."
        />
      ) : (
        <View style={sv.wrapper}>
          {depletion!.fastMovers.length > 0 && (
            <View style={[sv.card, Shadows.sm]}>
              <View style={sv.cardHeader}>
                <View style={[sv.categoryDot, { backgroundColor: Colors.danger }]} />
                <Text style={sv.categoryLabel}>Fast Movers</Text>
                <Text style={sv.categoryHint}>Monitor stock levels</Text>
              </View>
              {depletion!.fastMovers.slice(0, 5).map((p, i, arr) => {
                const isLast = i === arr.length - 1;
                const urgency =
                  p.daysUntilStockout != null && p.daysUntilStockout <= 3
                    ? 'critical'
                    : p.daysUntilStockout != null && p.daysUntilStockout <= 7
                    ? 'warning'
                    : 'ok';
                const dayColor =
                  urgency === 'critical'
                    ? Colors.danger
                    : urgency === 'warning'
                    ? Colors.warning
                    : Colors.success;
                return (
                  <View key={p.productId} style={[sv.row, !isLast && sv.rowBorder]}>
                    <View style={sv.rowLeft}>
                      <Text style={sv.itemName} numberOfLines={1}>{p.name}</Text>
                      <Text style={sv.velocity}>
                        {p.avgDailyVelocity.toFixed(1)} units/day · {p.quantity} in stock
                      </Text>
                    </View>
                    {p.daysUntilStockout != null ? (
                      <View style={[sv.daysBadge, { backgroundColor: `${dayColor}18` }]}>
                        <Ionicons name="time-outline" size={11} color={dayColor} />
                        <Text style={[sv.daysText, { color: dayColor }]}>
                          {Math.round(p.daysUntilStockout)}d
                        </Text>
                      </View>
                    ) : (
                      <Text style={sv.dashText}>—</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {depletion!.slowMovers.length > 0 && (
            <View style={[sv.card, Shadows.sm]}>
              <View style={sv.cardHeader}>
                <View style={[sv.categoryDot, { backgroundColor: Colors.textTertiary }]} />
                <Text style={sv.categoryLabel}>Slow Movers</Text>
                <Text style={sv.categoryHint}>Review pricing or placement</Text>
              </View>
              {depletion!.slowMovers.slice(0, 5).map((p, i, arr) => {
                const isLast = i === arr.length - 1;
                return (
                  <View key={p.productId} style={[sv.row, !isLast && sv.rowBorder]}>
                    <View style={sv.rowLeft}>
                      <Text style={sv.itemName} numberOfLines={1}>{p.name}</Text>
                      <Text style={sv.velocity}>
                        {p.avgDailyVelocity.toFixed(2)} units/day
                      </Text>
                    </View>
                    <View style={[sv.daysBadge, { backgroundColor: Colors.divider }]}>
                      <Ionicons name="cube-outline" size={11} color={Colors.textTertiary} />
                      <Text style={[sv.daysText, { color: Colors.textSecondary }]}>
                        {p.quantity} left
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const sv = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: Colors.divider,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    flex: 1,
  },
  categoryHint: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLeft: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  velocity: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    flexShrink: 0,
  },
  daysText: {
    fontSize: 12,
    fontFamily: Typography.fontFamilySemiBold,
  },
  dashText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
});

// ─── RevenueBreakdownCard ─────────────────────────────────────────────────────

interface RevenueBreakdownProps {
  summary: ReportSummary;
  currency?: string;
}

export function RevenueBreakdownCard({ summary, currency }: RevenueBreakdownProps) {
  if (summary.totalRevenue <= 0) return null;

  const expensePct = Math.min((summary.expenseTotal / summary.totalRevenue) * 100, 100);
  const profitPct = Math.max((summary.netProfit / summary.totalRevenue) * 100, 0);
  const profitNegative = summary.netProfit < 0;

  return (
    <Animated.View entering={FadeInDown.duration(360).delay(100)}>
      <View style={[rb.card, Shadows.sm]}>
        {/* stacked bar */}
        <View style={rb.barWrap}>
          {/* revenue full bar (background) */}
          <View style={rb.barBg} />
          {/* expenses portion — overlaid from left */}
          {summary.expenseTotal > 0 && (
            <View style={[rb.barExpense, { width: `${expensePct}%` }]} />
          )}
          {/* profit portion — fill from right */}
          {!profitNegative && profitPct > 0 && (
            <View style={[rb.barProfit, { width: `${profitPct}%` }]} />
          )}
          {/* midpoint divider if both exist */}
          {summary.expenseTotal > 0 && !profitNegative && (
            <View style={[rb.barDivider, { left: `${expensePct}%` }]} />
          )}
        </View>

        {/* metric columns */}
        <View style={rb.metricRow}>
          <View style={rb.metric}>
            <View style={[rb.dot, { backgroundColor: Colors.primary }]} />
            <Text style={rb.metricLabel}>Revenue</Text>
            <Text style={rb.metricValue}>{formatCurrency(summary.totalRevenue, currency)}</Text>
          </View>

          {summary.expenseTotal > 0 && (
            <>
              <View style={rb.vDivider} />
              <View style={rb.metric}>
                <View style={[rb.dot, { backgroundColor: '#F97316' }]} />
                <Text style={rb.metricLabel}>Expenses</Text>
                <Text style={[rb.metricValue, { color: '#F97316' }]}>
                  -{formatCurrency(summary.expenseTotal, currency)}
                </Text>
                <Text style={rb.metricSub}>{expensePct.toFixed(0)}% of rev.</Text>
              </View>
            </>
          )}

          <View style={rb.vDivider} />
          <View style={rb.metric}>
            <View style={[rb.dot, { backgroundColor: profitNegative ? Colors.danger : Colors.success }]} />
            <Text style={rb.metricLabel}>Net Profit</Text>
            <Text style={[rb.metricValue, { color: profitNegative ? Colors.danger : Colors.success }]}>
              {profitNegative ? '-' : ''}{formatCurrency(Math.abs(summary.netProfit), currency)}
            </Text>
            {!profitNegative && (
              <Text style={rb.metricSub}>{profitPct.toFixed(0)}% margin</Text>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const rb = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    paddingBottom: Spacing.md,
  },
  barWrap: {
    height: 6,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  barBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primarySubtle,
    borderRadius: 3,
  },
  barExpense: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#F97316',
    borderRadius: 3,
  },
  barProfit: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  barDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.surface,
  },
  metricRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 9,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 13,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  metricSub: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
  vDivider: {
    width: 1,
    backgroundColor: Colors.divider,
    alignSelf: 'stretch',
    marginHorizontal: 2,
  },
});

// ─── PeakActivitySection ──────────────────────────────────────────────────────

const BAR_COL = 40;
const BAR_W = 28;
const BAR_CHART_H = 110;
const BAR_TOP_PAD = 18;

interface PeakActivityProps {
  series: ReportBucket[];
  currency?: string;
  period: ReportPeriod;
}

export function PeakActivitySection({ series, currency, period }: PeakActivityProps) {
  const hasData = series.some((b) => b.total > 0);
  if (!hasData) return null;

  const maxTotal = Math.max(...series.map((b) => b.total), 1);
  const peakIndex = series.reduce(
    (best, b, i) => (b.total > series[best].total ? i : best),
    0,
  );
  const totalTxns = series.reduce((s, b) => s + b.transactionCount, 0);
  const peakBucket = series[peakIndex];
  const periodUnit = period === 'daily' ? 'hour' : 'day';
  const chartWidth = series.length * BAR_COL;

  return (
    <Animated.View entering={FadeInDown.duration(380).delay(230)}>
      <SectionHeader
        icon="bar-chart-outline"
        title="Activity Breakdown"
        subtitle={`Sales by ${periodUnit} · ${totalTxns} transactions total`}
        delay={210}
      />
      <View style={[pa.card, Shadows.sm]}>
        {/* peak callout strip */}
        {peakBucket && peakBucket.total > 0 && (
          <View style={pa.peakStrip}>
            <View style={pa.peakIconWrap}>
              <Ionicons name="flame" size={13} color={Colors.accent} />
            </View>
            <Text style={pa.peakText}>
              Peak: <Text style={pa.peakHighlight}>{peakBucket.label}</Text>
            </Text>
            <View style={pa.peakRight}>
              <Text style={pa.peakAmount}>{formatCurrency(peakBucket.total, currency)}</Text>
              <Text style={pa.peakTxns}>{peakBucket.transactionCount} sales</Text>
            </View>
          </View>
        )}

        {/* divider */}
        <View style={pa.stripDivider} />

        {/* bar chart */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={pa.scrollContent}
        >
          <View style={{ width: chartWidth }}>
            <Svg width={chartWidth} height={BAR_TOP_PAD + BAR_CHART_H + 2}>
              {/* grid lines at 50% and 100% */}
              {[0, 0.5].map((f) => (
                <SvgLine
                  key={f}
                  x1={0}
                  x2={chartWidth}
                  y1={BAR_TOP_PAD + BAR_CHART_H * f}
                  y2={BAR_TOP_PAD + BAR_CHART_H * f}
                  stroke={Colors.divider}
                  strokeWidth={1}
                />
              ))}

              {series.map((bucket, i) => {
                const barH = Math.max(
                  bucket.total > 0 ? (bucket.total / maxTotal) * BAR_CHART_H : 0,
                  bucket.total > 0 ? 4 : 0,
                );
                const x = i * BAR_COL + (BAR_COL - BAR_W) / 2;
                const y = BAR_TOP_PAD + BAR_CHART_H - barH;
                const isPeak = i === peakIndex;
                const intensity = 0.35 + (bucket.total / maxTotal) * 0.65;

                return (
                  <React.Fragment key={bucket.date + i}>
                    <Rect
                      x={x}
                      y={y}
                      width={BAR_W}
                      height={barH}
                      rx={5}
                      ry={5}
                      fill={isPeak ? Colors.accent : Colors.primary}
                      fillOpacity={isPeak ? 1 : intensity}
                    />
                    {isPeak && barH > 0 && (
                      <SvgText
                        x={x + BAR_W / 2}
                        y={y - 5}
                        textAnchor="middle"
                        fontSize={10}
                        fill={Colors.accentDark}
                        fontWeight="bold"
                      >
                        ★
                      </SvgText>
                    )}
                  </React.Fragment>
                );
              })}
            </Svg>

            {/* labels row */}
            <View style={pa.labelRow}>
              {series.map((bucket, i) => (
                <View key={bucket.date + i} style={{ width: BAR_COL, alignItems: 'center' }}>
                  <Text
                    style={[pa.label, i === peakIndex && pa.labelPeak]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {bucket.label}
                  </Text>
                  {bucket.transactionCount > 0 && (
                    <Text style={pa.txnCount}>{bucket.transactionCount}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const pa = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  peakStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    gap: 8,
  },
  peakIconWrap: {
    width: 26,
    height: 26,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peakText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  peakHighlight: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  peakRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  peakAmount: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  peakTxns: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
  stripDivider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  scrollContent: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: 2,
  },
  labelRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  label: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
  },
  labelPeak: {
    color: Colors.accentDark,
    fontFamily: Typography.fontFamilySemiBold,
  },
  txnCount: {
    fontSize: 9,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
    marginTop: 1,
  },
});
