import React, { useState, useMemo } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SalesDateRangeSheet } from '@/components/sales/SalesDateRangeSheet';
import { getSales, getSalesStats, voidSale, refundSale, type Sale, type SalesResponse } from '@/services/sales';
import { useAlert } from '@/context/AlertContext';
import { isOfflineQueued } from '@/utils/errors';
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

/** Extends a selected end date to the last instant of that calendar day, so
 * a date-range filter includes every sale made on the end date instead of
 * cutting off at local midnight. */
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

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
  const queryClient = useQueryClient();
  const { alert, toast } = useAlert();
  const currency = user?.shop?.currency ?? 'KES';

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [staffId, setStaffId] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

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
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const isDateFiltered = !!(startDate || endDate);
  // The picker always returns local-midnight Dates; extend the end date to
  // the last instant of that day here so the filter is correct at the
  // source, not just relying on the backend's own end-of-day handling.
  const normalizedEndDate = endDate ? endOfDay(endDate) : null;

  const { data: statsData } = useQuery({
    queryKey: ['salesStats', startDate?.toISOString(), normalizedEndDate?.toISOString()],
    queryFn: () => getSalesStats({
      startDate: startDate?.toISOString(),
      endDate: normalizedEndDate?.toISOString(),
    }),
  });

  const {
    data: salesData,
    isLoading,
    isFetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['sales', startDate, endDate, staffId, paymentFilter, searchQuery],
    queryFn: ({ pageParam }) =>
      getSales({
        startDate: startDate?.toISOString(),
        endDate: normalizedEndDate?.toISOString(),
        staffId: staffId || undefined,
        paymentMethod: paymentFilter !== 'all' ? paymentFilter : undefined,
        // Server-side: matches invoice number and cashier name across the
        // whole dataset, not just loaded pages.
        search: searchQuery || undefined,
        page: pageParam,
        limit: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: SalesResponse) =>
      lastPage.pagination.page < lastPage.pagination.pages
        ? lastPage.pagination.page + 1
        : undefined,
    // Keep showing the previous filter's results while the new one loads,
    // instead of the list dropping to empty/skeleton on every date change.
    placeholderData: keepPreviousData,
  });

  const { data: shopConfigData } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });
  const thankYouNote = shopConfigData?.data.receiptThankYouNote;
  const shopLogoUrl = shopConfigData?.data.logoUrl;
  const shopMotto = shopConfigData?.data.motto;
  // Bounds for the date-range picker: sales can't predate the shop or land
  // in the future, so neither is worth letting the user select.
  const shopCreatedAt = useMemo(
    () => (shopConfigData?.data.createdAt ? new Date(shopConfigData.data.createdAt) : new Date(0)),
    [shopConfigData?.data.createdAt]
  );
  const today = useMemo(() => new Date(), []);

  const allSales = salesData?.pages.flatMap((p) => p.data) ?? [];
  const totalCount = salesData?.pages[0]?.pagination.total ?? 0;

  // Search happens server-side (invoice number + cashier name); this only
  // applies the display sort order.
  const sales = useMemo(
    () => (sortOrder === 'asc' ? [...allSales].reverse() : allSales),
    [allSales, sortOrder],
  );

  const voidMutation = useMutation({
    mutationFn: (saleId: string) => voidSale(saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['salesStats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // stock restored
      setModalVisible(false);
      toast({ type: 'success', message: 'Sale voided — stock restored.' });
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        setModalVisible(false);
        toast({ type: 'info', message: 'Void saved offline — will sync when connected.' });
        return;
      }
      toast({ type: 'error', message: error.response?.data?.message || 'Could not void this sale.' });
    },
  });

  const handleVoid = (sale: Sale) => {
    alert({
      type: 'confirm',
      title: 'Void This Sale?',
      message: `${sale.invoiceNumber} (${formatCurrency(sale.totalAmount, currency)}) will be removed from your totals and its stock restored. This cannot be undone.`,
      buttons: [
        { label: 'Keep Sale', variant: 'ghost' },
        { label: 'Void Sale', variant: 'danger', onPress: () => voidMutation.mutate(sale._id) },
      ],
    });
  };

  const refundMutation = useMutation({
    mutationFn: ({ saleId, method }: { saleId: string; method?: 'cash' }) => refundSale(saleId, { method }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['salesStats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // stock restored (cash refunds)
      setModalVisible(false);
      toast({ type: 'success', message: res.message || 'Refund processed.' });
    },
    onError: (error: any) => {
      toast({ type: 'error', message: error.response?.data?.message || 'Could not refund this sale.' });
    },
  });

  const handleRefund = (sale: Sale) => {
    const amount = formatCurrency(sale.totalAmount, currency);
    if (sale.paymentMethod === 'mpesa') {
      alert({
        type: 'confirm',
        title: 'Refund This Sale?',
        message: `${amount} will be returned to the customer for ${sale.invoiceNumber}. Send it back through M-Pesa, or hand over cash?`,
        buttons: [
          { label: 'Cancel', variant: 'ghost' },
          { label: 'Refund in Cash', onPress: () => refundMutation.mutate({ saleId: sale._id, method: 'cash' }) },
          { label: 'Refund via M-Pesa', variant: 'danger', onPress: () => refundMutation.mutate({ saleId: sale._id }) },
        ],
      });
      return;
    }
    alert({
      type: 'confirm',
      title: 'Refund This Sale?',
      message: `Hand ${amount} back to the customer for ${sale.invoiceNumber}. The sale is removed from your totals and its stock restored. This cannot be undone.`,
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Refund Sale', variant: 'danger', onPress: () => refundMutation.mutate({ saleId: sale._id, method: 'cash' }) },
      ],
    });
  };

  const stats = statsData?.data;
  const totalSales = stats?.totalSales ?? 0;
  const pctChange = stats?.percentageChange ?? 0;
  const txCount = stats?.transactionCount ?? 0;
  const cashTotal = stats?.cashTotal ?? 0;
  const mpesaTotal = stats?.mpesaTotal ?? 0;
  const cardTotal = stats?.cardTotal ?? 0;
  const cashCount = stats?.cashCount;
  const mpesaCount = stats?.mpesaCount;
  const cardCount = stats?.cardCount;
  const avgSale = stats?.avgSale ?? 0;

  const cashPct = totalSales > 0 ? Math.round((cashTotal / totalSales) * 100) : 0;
  const mpesaPct = totalSales > 0 ? Math.round((mpesaTotal / totalSales) * 100) : 0;
  const cardPct = totalSales > 0 ? Math.round((cardTotal / totalSales) * 100) : 0;

  // When a date range is active, payment-method counts come from the same
  // filtered stats request. If the backend ignores the params it will return
  // this-month totals — in that case we only show the "All" count from the
  // paginated list, which is always correctly filtered server-side.
  const FILTER_TABS: { key: PaymentFilter; label: string; count: number | null }[] = [
    { key: 'all',   label: 'All Sales', count: totalCount },
    { key: 'mpesa', label: 'M-Pesa',   count: mpesaCount ?? null },
    { key: 'cash',  label: 'Cash',     count: cashCount  ?? null },
    { key: 'card',  label: 'Card',     count: cardCount  ?? null },
  ];

  const listHeader = useMemo(() => (
    <View>
      {/* ── Hero card ─────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(480).delay(60)} style={styles.heroWrapper}>
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroDecorCircle} />
          <View style={styles.heroDecorCircleSmall} />

          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <View style={styles.heroLabelRow}>
                <Text style={styles.heroLabel}>
                {isDateFiltered ? 'Total Sales (Selected Period)' : 'Total Sales (This Month)'}
              </Text>
                <Ionicons name="eye-outline" size={16} color="rgba(255,255,255,0.5)" style={{ marginLeft: 6 }} />
              </View>
              <Text style={styles.heroAmount}>{formatCurrency(totalSales, currency)}</Text>
              {!isDateFiltered && (
                <View style={[styles.changeBadge, { backgroundColor: pctChange >= 0 ? Colors.successSubtle : Colors.dangerSubtle }]}>
                  <Ionicons
                    name={pctChange >= 0 ? 'arrow-up' : 'arrow-down'}
                    size={11}
                    color={pctChange >= 0 ? Colors.success : Colors.danger}
                  />
                  <Text style={[styles.changeText, { color: pctChange >= 0 ? Colors.success : Colors.danger }]}>
                    {Math.abs(pctChange)}% vs last month
                  </Text>
                </View>
              )}
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
          iconColor={Colors.primary}
          iconBg={Colors.primarySubtle}
        />
        <PaymentStatCard
          icon="phone-portrait-outline"
          label="M-Pesa Sales"
          amount={formatCurrency(mpesaTotal, currency)}
          pct={mpesaTotal > 0 ? `${mpesaPct}%` : undefined}
          iconColor={Colors.primary}
          iconBg={Colors.primarySubtle}
          onPress={() => router.push('/(owner)/payments' as any)}
        />
        <PaymentStatCard
          icon="card-outline"
          label="Card Sales"
          amount={formatCurrency(cardTotal, currency)}
          pct={cardTotal > 0 ? `${cardPct}%` : undefined}
          iconColor={Colors.info}
          iconBg="#EDE9FE"
        />
        <PaymentStatCard
          icon="receipt-outline"
          label="Avg. Sale"
          amount={formatCurrency(avgSale, currency)}
          iconColor={Colors.warning}
          iconBg={Colors.warningSubtle}
        />
      </Animated.View>

      {/* ── Date range + Filters row ──────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(440).delay(160)} style={styles.dateFiltersRow}>
        <AnimatedPressable
          style={[styles.dateRangeBtn, { flex: 1 }]}
          onPress={() => setShowDateSheet(true)}
          accessibilityRole="button"
          accessibilityLabel={`Date range: ${formatDateRange(startDate, endDate)}. Tap to change.`}
        >
          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.dateRangeText}>{formatDateRange(startDate, endDate)}</Text>
          <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
        </AnimatedPressable>
        {(startDate || endDate) && (
          <AnimatedPressable
            style={styles.filtersBtn}
            onPress={() => { setStartDate(null); setEndDate(null); }}
            accessibilityRole="button"
            accessibilityLabel="Clear date filter"
          >
            <Ionicons name="close-circle-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.filtersBtnText}>Clear</Text>
          </AnimatedPressable>
        )}
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
              <AnimatedPressable
                key={tab.key}
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => setPaymentFilter(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
              >
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                  {tab.count !== null ? `${tab.label} (${tab.count})` : tab.label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* ── Section header ───────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Sales History</Text>
          {isFetching && !isLoading && !isFetchingNextPage && (
            <ActivityIndicator size="small" color={Colors.textTertiary} style={styles.sectionLoading} />
          )}
        </View>
        <AnimatedPressable
          onPress={() => setSortOrder((s) => (s === 'desc' ? 'asc' : 'desc'))}
          style={styles.sortLatestBtn}
          accessibilityRole="button"
          accessibilityLabel={`Sort order: ${sortOrder === 'desc' ? 'newest first' : 'oldest first'}`}
        >
          <Ionicons
            name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
            size={12}
            color={Colors.textSecondary}
          />
          <Text style={styles.sortLatestText}>
            {sortOrder === 'desc' ? 'Latest' : 'Oldest'}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [totalSales, txCount, pctChange, cashTotal, mpesaTotal, cardTotal, avgSale,
      cashPct, mpesaPct, cardPct, cashCount, mpesaCount, cardCount, totalCount,
      paymentFilter, searchValue, searchQuery, recentSearches, startDate, endDate,
      currency, isDateFiltered, sortOrder]);

  return (
    <View style={styles.container}>
      {/* ── Page header ─────────────────────────────────────────── */}
      <Animated.View entering={FadeIn.duration(350)} style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Sales</Text>
          <Text style={styles.pageSubtitle}>Track, analyze and manage all your sales</Text>
        </View>
        <AnimatedPressable
          style={styles.notifBtn}
          onPress={() => router.push('/(owner)/reports' as any)}
          accessibilityRole="button"
          accessibilityLabel="View reports"
        >
          <Ionicons name="bar-chart-outline" size={22} color={Colors.textPrimary} />
        </AnimatedPressable>
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

      <SalesDateRangeSheet
        visible={showDateSheet}
        onClose={() => setShowDateSheet(false)}
        startDate={startDate}
        endDate={endDate}
        minDate={shopCreatedAt}
        maxDate={today}
        onApply={(start, end) => { setStartDate(start); setEndDate(end); }}
        onClear={() => { setStartDate(null); setEndDate(null); }}
      />

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
        canVoid
        onVoid={handleVoid}
        voiding={voidMutation.isPending}
        canRefund
        onRefund={handleRefund}
        refunding={refundMutation.isPending}
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
  <AnimatedPressable style={statStyles.card} onPress={onPress} disabled={!onPress}>
    <View style={[statStyles.iconBox, { backgroundColor: iconBg }]}>
      <Ionicons name={icon as any} size={16} color={iconColor} />
    </View>
    <Text style={statStyles.label} numberOfLines={1}>{label}</Text>
    <Text style={statStyles.amount} numberOfLines={1}>{amount}</Text>
    {pct ? <Text style={[statStyles.pct, { color: iconColor }]}>{pct}</Text> : <Text style={statStyles.dash}>—</Text>}
    {onPress && <Ionicons name="chevron-forward" size={10} color={Colors.textTertiary} style={{ marginTop: 2 }} />}
  </AnimatedPressable>
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
    color: Colors.white,
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
    color: Colors.white,
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
    color: Colors.white,
  },

  // ── Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  sectionLoading: {
    marginLeft: 2,
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
