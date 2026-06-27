import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { DatePicker } from '@/components/ui/DatePicker';
import { getSales, getSalesStats, type Sale, type SalesResponse } from '@/services/sales';
import { getShopConfig } from '@/services/shop';
import { SalesList } from '@/components/sales/SalesList';
import { SaleDetailsModal } from '@/components/sales/SaleDetailsModal';
import { ContextualSearchBar } from '@/components/ui/ContextualSearchBar';
import { useSearch } from '@/hooks/useSearch';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { useRouter } from 'expo-router';
import { formatCurrency, formatDate } from '@/utils/formatters';

type PaymentFilter = 'all' | 'mpesa' | 'cash' | 'card';

function formatDateRange(start: Date | null, end: Date | null): string {
  if (!start && !end) {
    const now = new Date();
    return `${formatDate(now.toISOString())} – ${formatDate(now.toISOString())}`;
  }
  const s = start ? formatDate(start.toISOString()) : '…';
  const e = end ? formatDate(end.toISOString()) : '…';
  return `${s} – ${e}`;
}

export default function OwnerSales() {
  const user = useAuthStore((s: AuthState) => s.user);
  const router = useRouter();
  const currency = user?.shop?.currency ?? 'KES';

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [staffId, setStaffId] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');

  const {
    value: searchValue,
    query: searchQuery,
    onChange: onSearchChange,
    onSubmit: onSearchSubmit,
    selectRecent,
    recentSearches,
    clearRecent,
    clear: clearSearch,
  } = useSearch('sales');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { data: statsData } = useQuery({
    queryKey: ['salesStats'],
    queryFn: getSalesStats,
  });

  const {
    data: salesData,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['sales', startDate, endDate, staffId, paymentFilter],
    queryFn: ({ pageParam }) =>
      getSales({
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        staffId: staffId || undefined,
        paymentMethod: paymentFilter !== 'all' ? paymentFilter : undefined,
        page: pageParam,
        limit: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: SalesResponse) =>
      lastPage.pagination.page < lastPage.pagination.pages
        ? lastPage.pagination.page + 1
        : undefined,
  });

  const { data: shopConfigData } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });
  const thankYouNote = shopConfigData?.data.receiptThankYouNote;
  const shopLogoUrl = shopConfigData?.data.logoUrl;
  const shopMotto = shopConfigData?.data.motto;

  const allSales = salesData?.pages.flatMap((p) => p.data) ?? [];
  const totalCount = salesData?.pages[0]?.pagination.total ?? 0;

  // Client-side filter: sales API doesn't support full-text search, so we
  // filter the already-fetched pages by invoice number and cashier name.
  const sales = useMemo(() => {
    if (!searchQuery) return allSales;
    const q = searchQuery.toLowerCase();
    return allSales.filter(
      (s) =>
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.staff?.name?.toLowerCase().includes(q),
    );
  }, [allSales, searchQuery]);

  const stats = statsData?.data;
  const totalSales = stats?.totalSales ?? 0;
  const pctChange = stats?.percentageChange ?? 0;
  const txCount = stats?.transactionCount ?? 0;
  const cashTotal = stats?.cashTotal ?? 0;
  const mpesaTotal = stats?.mpesaTotal ?? 0;
  const cardTotal = stats?.cardTotal ?? 0;
  const cashCount = stats?.cashCount ?? 0;
  const mpesaCount = stats?.mpesaCount ?? 0;
  const cardCount = stats?.cardCount ?? 0;
  const avgSale = stats?.avgSale ?? 0;

  const cashPct = totalSales > 0 ? Math.round((cashTotal / totalSales) * 100) : 0;
  const mpesaPct = totalSales > 0 ? Math.round((mpesaTotal / totalSales) * 100) : 0;
  const cardPct = totalSales > 0 ? Math.round((cardTotal / totalSales) * 100) : 0;

  const FILTER_TABS: { key: PaymentFilter; label: string; count: number }[] = [
    { key: 'all',   label: 'All Sales',  count: totalCount },
    { key: 'mpesa', label: 'M-Pesa',     count: mpesaCount },
    { key: 'cash',  label: 'Cash',       count: cashCount },
    { key: 'card',  label: 'Card',       count: cardCount },
  ];

  const listHeader = useMemo(() => (
    <View>
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
              <View style={styles.heroLabelRow}>
                <Text style={styles.heroLabel}>Total Sales (This Month)</Text>
                <Ionicons name="eye-outline" size={16} color="rgba(255,255,255,0.5)" style={{ marginLeft: 6 }} />
              </View>
              <Text style={styles.heroAmount}>{formatCurrency(totalSales, currency)}</Text>
              <View style={[styles.changeBadge, { backgroundColor: pctChange >= 0 ? 'rgba(74,222,128,0.18)' : 'rgba(239,68,68,0.18)' }]}>
                <Ionicons
                  name={pctChange >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={11}
                  color={pctChange >= 0 ? '#4ADE80' : '#F87171'}
                />
                <Text style={[styles.changeText, { color: pctChange >= 0 ? '#4ADE80' : '#F87171' }]}>
                  {Math.abs(pctChange)}% vs last month
                </Text>
              </View>
            </View>

            <View style={styles.heroRight}>
              <View style={styles.txIconBox}>
                <Ionicons name="bar-chart" size={18} color="rgba(255,255,255,0.9)" />
              </View>
              <Text style={styles.txLabel}>Total Transactions</Text>
              <Text style={styles.txCount}>{txCount}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ── Payment breakdown cards ────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(460).delay(120)} style={styles.statsRow}>
        <PaymentStatCard
          icon="cash-outline"
          label="Cash Sales"
          amount={formatCurrency(cashTotal, currency)}
          pct={cashTotal > 0 ? `${cashPct}%` : undefined}
          iconColor="#0F766E"
          iconBg="#CCFBF1"
        />
        <PaymentStatCard
          icon="phone-portrait-outline"
          label="M-Pesa Sales"
          amount={formatCurrency(mpesaTotal, currency)}
          pct={mpesaTotal > 0 ? `${mpesaPct}%` : undefined}
          iconColor="#0F766E"
          iconBg="#CCFBF1"
          onPress={() => router.push('/(owner)/payments' as any)}
        />
        <PaymentStatCard
          icon="card-outline"
          label="Card Sales"
          amount={formatCurrency(cardTotal, currency)}
          pct={cardTotal > 0 ? `${cardPct}%` : undefined}
          iconColor="#7C3AED"
          iconBg="#EDE9FE"
        />
        <PaymentStatCard
          icon="receipt-outline"
          label="Avg. Sale"
          amount={formatCurrency(avgSale, currency)}
          iconColor="#92400E"
          iconBg="#FEF3C7"
        />
      </Animated.View>

      {/* ── Date range + Filters row ──────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(440).delay(160)} style={styles.dateFiltersRow}>
        <TouchableOpacity
          style={styles.dateRangeBtn}
          onPress={() => setShowStartPicker(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.dateRangeText}>{formatDateRange(startDate, endDate)}</Text>
          <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.filtersBtn} activeOpacity={0.75} onPress={() => {}}>
          <Ionicons name="filter-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.filtersBtnText}>Filters</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Search bar ────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(430).delay(180)} style={styles.searchWrapper}>
        <ContextualSearchBar
          value={searchValue}
          onChangeText={onSearchChange}
          onSubmit={onSearchSubmit}
          recentSearches={recentSearches}
          onSelectRecent={selectRecent}
          onClearRecent={clearRecent}
          placeholder="Search invoice or cashier name…"
        />
      </Animated.View>

      {/* ── Filter pill tabs ──────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(420).delay(200)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabs}
        >
          {FILTER_TABS.map((tab) => {
            const active = paymentFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => setPaymentFilter(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* ── Section header ───────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sales History</Text>
        <TouchableOpacity style={styles.sortLatestBtn} activeOpacity={0.75}>
          <Text style={styles.sortLatestText}>Latest</Text>
          <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [totalSales, txCount, pctChange, cashTotal, mpesaTotal, cardTotal, avgSale,
      cashPct, mpesaPct, cardPct, cashCount, mpesaCount, cardCount, totalCount,
      paymentFilter, searchValue, searchQuery, recentSearches, startDate, endDate, currency]);

  return (
    <View style={styles.container}>
      {/* ── Page header ─────────────────────────────────────────── */}
      <Animated.View entering={FadeIn.duration(350)} style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Sales</Text>
          <Text style={styles.pageSubtitle}>Track, analyze and manage all your sales</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} activeOpacity={0.75}>
          <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </Animated.View>

      <SalesList
        sales={sales}
        isLoading={isLoading}
        currency={currency}
        onRefresh={refetch}
        onPressSale={(sale) => { setSelectedSale(sale); setModalVisible(true); }}
        showStaff
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        isFetchingNextPage={isFetchingNextPage}
        listHeader={listHeader}
      />

      {showStartPicker && (
        <DatePicker
          value={startDate || new Date()}
          onChange={(date) => {
            setShowStartPicker(false);
            if (date) { setStartDate(date); setShowEndPicker(true); }
          }}
        />
      )}
      {showEndPicker && (
        <DatePicker
          value={endDate || new Date()}
          onChange={(date) => { setShowEndPicker(false); if (date) setEndDate(date); }}
        />
      )}

      <SaleDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        sale={selectedSale}
        shopName={user?.shop?.name || 'Smart Duka'}
        shopPhone={user?.shop?.phone}
        currency={currency}
        thankYouNote={thankYouNote}
        logoUrl={shopLogoUrl}
        motto={shopMotto}
      />
    </View>
  );
}

interface PaymentStatCardProps {
  icon: string;
  label: string;
  amount: string;
  pct?: string;
  iconColor: string;
  iconBg: string;
  onPress?: () => void;
}

const PaymentStatCard: React.FC<PaymentStatCardProps> = ({ icon, label, amount, pct, iconColor, iconBg, onPress }) => (
  <TouchableOpacity style={statStyles.card} onPress={onPress} activeOpacity={onPress ? 0.72 : 1} disabled={!onPress}>
    <View style={[statStyles.iconBox, { backgroundColor: iconBg }]}>
      <Ionicons name={icon as any} size={16} color={iconColor} />
    </View>
    <Text style={statStyles.label} numberOfLines={1}>{label}</Text>
    <Text style={statStyles.amount} numberOfLines={1}>{amount}</Text>
    {pct ? <Text style={[statStyles.pct, { color: iconColor }]}>{pct}</Text> : <Text style={statStyles.dash}>—</Text>}
    {onPress && <Ionicons name="chevron-forward" size={10} color={Colors.textTertiary} style={{ marginTop: 2 }} />}
  </TouchableOpacity>
);

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 10,
    alignItems: 'flex-start',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
  },
  amount: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  pct: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
  },
  dash: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Page header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  pageTitle: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },

  // ── Hero card
  heroWrapper: {
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
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.04)',
    right: -40,
    top: -60,
  },
  heroDecorCircleSmall: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    left: -30,
    bottom: -30,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
    gap: 6,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: Typography.size.caption,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: Typography.fontFamily,
  },
  heroAmount: {
    fontSize: 30,
    fontFamily: Typography.fontFamilyBold,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  changeText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
  },
  heroRight: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  txIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
  },
  txCount: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: '#FFFFFF',
  },

  // ── Payment stat cards
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },

  // ── Date range + filters
  dateFiltersRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  dateRangeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateRangeText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily,
  },
  filtersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filtersBtnText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamilySemiBold,
  },

  // ── Search wrapper (ContextualSearchBar manages its own internal styles)
  searchWrapper: {
    marginBottom: Spacing.sm,
  },

  // ── Filter pill tabs
  filterTabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  filterTab: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.surface,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTabText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
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
  sortLatestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sortLatestText: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
