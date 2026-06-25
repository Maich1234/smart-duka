import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { getMpesaTransactions, type MpesaTransaction, type MpesaTransactionStatus } from '@/services/mpesa';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

const STATUS_FILTERS: Array<{ label: string; value: MpesaTransactionStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Success', value: 'success' },
  { label: 'Pending', value: 'pending' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_COLORS: Record<MpesaTransactionStatus, { bg: string; text: string; dot: string }> = {
  success: { bg: Colors.successSubtle, text: Colors.success, dot: Colors.success },
  pending: { bg: Colors.warningSubtle, text: '#92400E', dot: Colors.warning },
  failed: { bg: Colors.dangerSubtle, text: Colors.danger, dot: Colors.danger },
  cancelled: { bg: '#F3F4F6', text: Colors.textSecondary, dot: Colors.textTertiary },
  timeout: { bg: '#F3F4F6', text: Colors.textSecondary, dot: Colors.textTertiary },
};

export default function PaymentsScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MpesaTransactionStatus | 'all'>('all');
  const [selectedTx, setSelectedTx] = useState<MpesaTransaction | null>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['mpesaTransactions', search, statusFilter],
    queryFn: ({ pageParam = 1 }) =>
      getMpesaTransactions({
        page: pageParam as number,
        limit: 20,
        ...(search ? { search } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      }),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });

  const allTransactions = data?.pages.flatMap((p) => p.data) ?? [];
  const stats = data?.pages[0]?.stats;

  return (
    <View style={styles.container}>
      <FlatList
        data={allTransactions}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary} />
        }
        ListHeaderComponent={
          <View>
            {/* Hero stats */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.heroWrap}>
              <LinearGradient
                colors={['#0B1D1B', '#0F2E2A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.orb} />
                <View style={styles.heroTop}>
                  <View style={styles.heroIconWrap}>
                    <Ionicons name="phone-portrait" size={18} color="#14B8A6" />
                  </View>
                  <Text style={styles.heroLabel}>Lipa Na M-Pesa</Text>
                </View>
                <Text style={styles.heroVolume}>
                  {formatCurrency(stats?.totalVolume ?? 0, 'KES')}
                </Text>
                <Text style={styles.heroSub}>Total confirmed volume</Text>
                <View style={styles.heroDivider} />
                <View style={styles.heroStatsRow}>
                  <HeroStat label="Transactions" value={String(stats?.totalCount ?? 0)} />
                  <View style={styles.heroStatDivider} />
                  <HeroStat label="Success Rate" value={`${stats?.successRate ?? 0}%`} />
                  <View style={styles.heroStatDivider} />
                  <HeroStat label="Successful" value={String(stats?.successCount ?? 0)} />
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Search + filters */}
            <View style={styles.filtersWrap}>
              <SearchBar value={search} onChangeText={setSearch} placeholder="Search by phone or reference..." />
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={STATUS_FILTERS}
                keyExtractor={(item) => item.value}
                contentContainerStyle={styles.statusFilters}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.filterChip, statusFilter === item.value && styles.filterChipActive]}
                    onPress={() => setStatusFilter(item.value as any)}
                    activeOpacity={0.72}
                  >
                    <Text style={[styles.filterChipText, statusFilter === item.value && styles.filterChipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            <Text style={styles.listLabel}>TRANSACTIONS</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInUp.duration(280).delay(index < 10 ? index * 30 : 0)}>
            <TransactionCard
              tx={item}
              onPress={() => setSelectedTx(item)}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No M-Pesa transactions yet"
              subtitle="M-Pesa payments made at checkout will appear here"
            />
          ) : null
        }
      />

      {/* Transaction detail bottom sheet */}
      {selectedTx && (
        <TransactionDetailSheet tx={selectedTx} onClose={() => setSelectedTx(null)} />
      )}
    </View>
  );
}

// ─── Hero stat cell ───────────────────────────────────────────────────────────

const HeroStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.heroStat}>
    <Text style={styles.heroStatValue}>{value}</Text>
    <Text style={styles.heroStatLabel}>{label}</Text>
  </View>
);

// ─── Transaction card ─────────────────────────────────────────────────────────

const TransactionCard: React.FC<{ tx: MpesaTransaction; onPress: () => void }> = ({ tx, onPress }) => {
  const colors = STATUS_COLORS[tx.status] ?? STATUS_COLORS.failed;
  return (
    <TouchableOpacity style={styles.txCard} onPress={onPress} activeOpacity={0.72}>
      <View style={styles.txLeft}>
        <View style={[styles.txDot, { backgroundColor: colors.dot }]} />
        <View style={styles.txInfo}>
          <Text style={styles.txPhone}>{formatPhone(tx.phoneNumber)}</Text>
          {tx.mpesaReceiptNumber && (
            <Text style={styles.txRef}>{tx.mpesaReceiptNumber}</Text>
          )}
          <Text style={styles.txTime}>{formatDateTime(tx.createdAt)}</Text>
        </View>
      </View>
      <View style={styles.txRight}>
        <Text style={styles.txAmount}>{formatCurrency(tx.amount, 'KES')}</Text>
        <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusBadgeText, { color: colors.text }]}>
            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
          </Text>
        </View>
        {tx.saleId && (
          <Text style={styles.txSaleRef}>{tx.saleId.invoiceNumber}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ─── Transaction detail sheet ─────────────────────────────────────────────────

const TransactionDetailSheet: React.FC<{ tx: MpesaTransaction; onClose: () => void }> = ({ tx, onClose }) => {
  const colors = STATUS_COLORS[tx.status] ?? STATUS_COLORS.failed;

  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View entering={FadeInDown.springify()} style={styles.detailSheet}>
        <View style={styles.sheetHandle} />

        <View style={styles.detailHeader}>
          <View style={[styles.detailStatusDot, { backgroundColor: colors.dot }]} />
          <Text style={styles.detailTitle}>
            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)} Transaction
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.detailAmount}>
          <Text style={styles.detailAmountLabel}>Amount</Text>
          <Text style={styles.detailAmountValue}>{formatCurrency(tx.amount, 'KES')}</Text>
        </View>

        <View style={styles.detailRows}>
          <DetailRow label="Phone Number" value={formatPhone(tx.phoneNumber)} />
          {tx.mpesaReceiptNumber && <DetailRow label="M-Pesa Receipt" value={tx.mpesaReceiptNumber} highlight />}
          {tx.saleId && <DetailRow label="Invoice" value={tx.saleId.invoiceNumber} />}
          {tx.requestedBy && <DetailRow label="Cashier" value={tx.requestedBy.name} />}
          <DetailRow label="Date & Time" value={formatDateTime(tx.createdAt)} />
          <DetailRow label="Status" value={tx.status.charAt(0).toUpperCase() + tx.status.slice(1)} />
          {tx.errorMessage && <DetailRow label="Note" value={tx.errorMessage} />}
        </View>
      </Animated.View>
    </View>
  );
};

const DetailRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailRowLabel}>{label}</Text>
    <Text style={[styles.detailRowValue, highlight && styles.detailRowHighlight]}>{value}</Text>
  </View>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('254') && d.length === 12) return `+254 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  return phone;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  // Hero
  heroWrap: {
    margin: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(20,184,166,0.07)',
    top: -50,
    right: -40,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  heroIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(20,184,166,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: 'rgba(255,255,255,0.6)',
  },
  heroVolume: {
    fontSize: 28,
    fontFamily: Typography.fontFamilyBold,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: Typography.fontFamily,
    marginTop: 2,
    marginBottom: 14,
  },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 14 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroStatValue: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: '#FFFFFF',
  },
  heroStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  // Filters
  filtersWrap: { paddingHorizontal: Spacing.lg, marginBottom: 4 },
  statusFilters: { gap: 8, paddingVertical: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primarySubtle,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  filterChipTextActive: { color: Colors.primary },
  listLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    paddingHorizontal: Spacing.lg,
    marginBottom: 6,
    marginTop: 4,
  },
  // Transaction card
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  txLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  txDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  txInfo: { flex: 1 },
  txPhone: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  txRef: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
    letterSpacing: 0.3,
  },
  txTime: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
  },
  txSaleRef: {
    fontSize: 10,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    letterSpacing: 0.2,
  },
  // Detail sheet
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  detailSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    marginBottom: 16,
  },
  detailStatusDot: { width: 10, height: 10, borderRadius: 5 },
  detailTitle: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  detailAmount: {
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: 14,
    marginBottom: 16,
  },
  detailAmountLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  detailAmountValue: {
    fontSize: 28,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  detailRows: {
    paddingHorizontal: Spacing.lg,
    gap: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  detailRowLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  detailRowValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    maxWidth: '55%',
    textAlign: 'right',
  },
  detailRowHighlight: {
    color: Colors.success,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: 0.5,
  },
});
