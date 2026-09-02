import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useAlert } from '@/context/AlertContext';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import {
  getPurchaseById,
  approvePurchase,
  deletePurchase,
  type Purchase,
  type PurchaseStatus,
} from '@/services/purchases';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { haptics } from '@/utils/haptics';
import { purchasingBasePath } from '@/utils/purchasingRoutes';
import { isOfflineQueued, mutationErrorMessage } from '@/utils/errors';
import { purchaseCostCategoryMeta } from '@/constants/purchaseCostCategories';
import { MONEY_OUT_METHOD_LABELS } from '@/constants/paymentMethods';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const STATUS_STYLE: Record<PurchaseStatus, { label: string; bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  completed: { label: 'Completed', bg: Colors.successSubtle, fg: Colors.success, icon: 'checkmark-circle' },
  pending_approval: { label: 'Awaiting approval', bg: Colors.warningSubtle, fg: '#B45309', icon: 'hourglass-outline' },
  cancelled: { label: 'Cancelled', bg: Colors.dangerSubtle, fg: Colors.danger, icon: 'close-circle' },
};

const ALLOCATION_NOTE: Record<Purchase['allocationMethod'], string> = {
  quantity: 'Extra costs were spread across items by quantity, so each unit carries a share of them.',
  value: 'Extra costs were spread across items by value, so pricier items carry more of them.',
  none: 'Extra costs were recorded against this purchase but not folded into item cost prices.',
};

const supplierMeta = (purchase: Purchase) =>
  typeof purchase.supplier === 'object' && purchase.supplier !== null ? purchase.supplier : null;

interface DetailRowProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, icon }) => (
  <View style={styles.detailRow}>
    {icon && <Ionicons name={icon} size={15} color={Colors.textTertiary} />}
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
  </View>
);

/**
 * The full breakdown of one purchase — items, landed costs, totals and who
 * recorded it. Mounted from both (owner)/purchases/[id].tsx and
 * (staff)/purchases/[id].tsx.
 *
 * This is also the only place a `pending_approval` purchase can be released:
 * staff without `auto_approve_purchases` create purchases that hold their
 * stock until the owner signs off here, so the Approve action is not optional
 * polish — without it such a purchase never lands.
 *
 * Money is withheld from staff who lack `view_purchase_prices`, so every
 * amount is conditional and the screen has to stay useful with none of them.
 */
export function PurchaseDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const role = useAuthStore((s: AuthState) => s.user?.role);
  const currency = useAuthStore((s: AuthState) => s.user?.shop?.currency);
  const base = purchasingBasePath(role);
  const tabBarHeight = useTabBarHeight();
  const queryClient = useQueryClient();
  const { alert, toast } = useAlert();

  const canView = usePermission('view_purchases');
  const canCancel = usePermission('delete_purchases');
  const isOwner = role === 'owner';

  const { data, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => getPurchaseById(id),
    enabled: canView && !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase', id] });
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
    queryClient.invalidateQueries({ queryKey: ['purchaseStats'] });
    queryClient.invalidateQueries({ queryKey: ['purchaseAnalytics'] });
    // Approving or cancelling moves stock, so inventory is stale too.
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  // Both writes go through the offline outbox (/purchases isn't REALTIME_ONLY),
  // and the backend guards replays with idempotency plus a status check — so a
  // queued approve/cancel is safe, and must be reported as queued rather than
  // as a failure the user would retry by hand.
  const approveMutation = useMutation({
    mutationFn: () => approvePurchase(id),
    onSuccess: (res) => {
      invalidate();
      toast({ type: 'success', message: res.message || 'Purchase approved. Stock updated.' });
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        toast({ type: 'info', message: 'Approval will sync when connected.' });
        return;
      }
      toast({
        type: 'error',
        message: mutationErrorMessage(error, 'Could not approve this purchase.'),
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => deletePurchase(id),
    onSuccess: (res) => {
      invalidate();
      toast({ type: 'success', message: res.message || 'Purchase cancelled.' });
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        toast({ type: 'info', message: 'Cancellation will sync when connected.' });
        return;
      }
      toast({
        type: 'error',
        message: mutationErrorMessage(error, 'Could not cancel this purchase.'),
      });
    },
  });

  const handleApprove = () => {
    haptics.light();
    alert({
      type: 'confirm',
      title: 'Approve this purchase?',
      message: 'Stock will be added to your inventory and cost prices updated.',
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Approve', variant: 'primary', onPress: () => approveMutation.mutate() },
      ],
    });
  };

  const handleCancel = () => {
    haptics.light();
    alert({
      type: 'confirm',
      title: 'Cancel this purchase?',
      message:
        'The record is kept for your history, and any stock it added is reversed. This cannot be undone.',
      buttons: [
        { label: 'Keep it', variant: 'ghost' },
        { label: 'Cancel purchase', variant: 'danger', onPress: () => cancelMutation.mutate() },
      ],
    });
  };

  if (!canView) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="lock-closed-outline" size={40} color={Colors.textTertiary} />
        <Text style={styles.centerTitle}>No access</Text>
        <Text style={styles.centerSub}>Ask your shop owner to grant you purchasing access.</Text>
      </View>
    );
  }

  if (isLoading) {
    return <ListSkeleton rows={5} heroHeight={140} />;
  }

  const purchase = data?.data;
  if (isError || !purchase) {
    return <QueryError onRetry={refetch} />;
  }

  const status = STATUS_STYLE[purchase.status] ?? STATUS_STYLE.completed;
  const supplier = supplierMeta(purchase);
  const costs = purchase.additionalCosts ?? [];
  const showMoney = purchase.grandTotal != null;
  const busy = approveMutation.isPending || cancelMutation.isPending;

  return (
    <ScrollView
      style={styles.flex}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.headerCard}>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon} size={12} color={status.fg} />
            <Text style={[styles.statusPillText, { color: status.fg }]}>{status.label}</Text>
          </View>

          <Text style={styles.supplierName} numberOfLines={2}>
            {purchase.supplierName || 'Walk-in purchase'}
          </Text>
          <Text style={styles.headerDate}>{formatDate(purchase.purchaseDate)}</Text>

          {showMoney && (
            <>
              <View style={styles.headerDivider} />
              <Text style={styles.headerTotalLabel}>Total cost</Text>
              <Text style={styles.headerTotal}>{formatCurrency(purchase.grandTotal!, currency)}</Text>
            </>
          )}
        </View>
      </View>

      {purchase.status === 'pending_approval' && (
        <View style={styles.section}>
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={18} color="#B45309" />
            <Text style={styles.noticeText}>
              {isOwner
                ? 'Stock has not been added yet. Approve this purchase to release it into your inventory.'
                : 'Stock has not been added yet. Your shop owner needs to approve this purchase first.'}
            </Text>
          </View>
        </View>
      )}

      {/* ── Items ──────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          ITEMS ({purchase.items.length})
        </Text>
        <View style={styles.card}>
          {purchase.items.map((item, index) => (
            <View
              key={`${item.productId}-${item.variantId ?? 'base'}-${index}`}
              style={[styles.itemRow, index < purchase.items.length - 1 && styles.rowBorder]}
            >
              <View style={styles.itemText}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.productName}
                  {item.variantName ? ` · ${item.variantName}` : ''}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} {item.unitOfMeasure ?? 'unit'}
                  {item.quantity === 1 ? '' : 's'}
                  {item.unitCost != null ? ` × ${formatCurrency(item.unitCost, currency)}` : ''}
                </Text>
              </View>
              {item.totalCost != null && (
                <Text style={styles.itemAmount}>{formatCurrency(item.totalCost, currency)}</Text>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* ── Extra costs ────────────────────────────────────────────── */}
      {costs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>EXTRA COSTS ({costs.length})</Text>
          <View style={styles.card}>
            {costs.map((cost, index) => {
              const meta = purchaseCostCategoryMeta(cost.category);
              return (
                <View
                  key={cost._id ?? `${cost.category}-${index}`}
                  style={[styles.itemRow, index < costs.length - 1 && styles.rowBorder]}
                >
                  <Ionicons name={meta.icon} size={16} color={Colors.textSecondary} />
                  <View style={styles.itemText}>
                    <Text style={styles.itemName}>{meta.label}</Text>
                    {!!cost.description && (
                      <Text style={styles.itemMeta} numberOfLines={2}>{cost.description}</Text>
                    )}
                  </View>
                  {cost.amount != null && (
                    <Text style={styles.itemAmount}>{formatCurrency(cost.amount, currency)}</Text>
                  )}
                </View>
              );
            })}
          </View>
          <Text style={styles.allocationNote}>{ALLOCATION_NOTE[purchase.allocationMethod]}</Text>
        </View>
      )}

      {/* ── Totals ─────────────────────────────────────────────────── */}
      {showMoney ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TOTALS</Text>
          <View style={styles.card}>
            <View style={[styles.totalRow, styles.rowBorder]}>
              <Text style={styles.totalLabel}>Items</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(purchase.productsTotal ?? 0, currency)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.rowBorder]}>
              <Text style={styles.totalLabel}>Extra costs</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(purchase.additionalCostsTotal ?? 0, currency)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.grandLabel}>Grand total</Text>
              <Text style={styles.grandValue}>
                {formatCurrency(purchase.grandTotal ?? 0, currency)}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.noticeCardMuted}>
            <Ionicons name="eye-off-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.noticeMutedText}>
              Costs are hidden. You don&apos;t have permission to see purchase prices.
            </Text>
          </View>
        </View>
      )}

      {/* ── Record details ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>RECORD</Text>
        <View style={styles.card}>
          <DetailRow
            label="Paid with"
            // Absent on purchases recorded before the field existed.
            value={MONEY_OUT_METHOD_LABELS[purchase.paymentMethod ?? 'cash']}
            icon="wallet-outline"
          />
          <View style={styles.rowBorder} />
          <DetailRow label="Recorded by" value={purchase.staff?.name ?? '-'} icon="person-outline" />
          <View style={styles.rowBorder} />
          <DetailRow label="Recorded on" value={formatDate(purchase.createdAt)} icon="calendar-outline" />
          {purchase.cancelledAt && (
            <>
              <View style={styles.rowBorder} />
              <DetailRow
                label="Cancelled"
                value={`${formatDate(purchase.cancelledAt)}${purchase.cancelledBy ? ` by ${purchase.cancelledBy.name}` : ''}`}
                icon="close-circle-outline"
              />
            </>
          )}
        </View>
      </View>

      {/* ── Supplier ───────────────────────────────────────────────── */}
      {supplier && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SUPPLIER</Text>
          <AnimatedPressable
            style={styles.card}
            onPress={() => {
              haptics.light();
              // Opens the directory with this supplier's sheet already up, so
              // the row leads somewhere specific rather than to a list to
              // search all over again.
              router.push({
                pathname: `${base}/suppliers`,
                params: { supplierId: supplier._id },
              } as never);
            }}
            accessibilityRole="button"
            accessibilityLabel={`View ${supplier.name}`}
          >
            <View style={styles.supplierRow}>
              <View style={styles.supplierIconWrap}>
                <Ionicons name="business-outline" size={16} color={Colors.primary} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemName}>{supplier.name}</Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {[supplier.phone, supplier.location].filter(Boolean).join(' · ') || 'No contact details'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </View>
          </AnimatedPressable>
        </View>
      )}

      {/* ── Actions ────────────────────────────────────────────────── */}
      {purchase.status !== 'cancelled' && (isOwner || canCancel) && (
        <View style={styles.section}>
          {purchase.status === 'pending_approval' && isOwner && (
            <Button
              title="Approve purchase"
              leftIcon="checkmark-circle-outline"
              onPress={handleApprove}
              loading={approveMutation.isPending}
              disabled={busy}
              style={styles.actionBtn}
            />
          )}
          {canCancel && (
            <Button
              title="Cancel purchase"
              variant="outline"
              leftIcon="close-circle-outline"
              onPress={handleCancel}
              loading={cancelMutation.isPending}
              disabled={busy}
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: 8,
    backgroundColor: Colors.background,
  },
  centerTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 4,
  },
  centerSub: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 6,
    ...Shadows.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusPillText: { fontSize: 10, fontFamily: Typography.fontFamilySemiBold },
  supplierName: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  headerDate: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  headerDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 8,
  },
  headerTotalLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headerTotal: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },

  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.warningSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  noticeText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: '#78350F',
    lineHeight: 20,
  },
  noticeCardMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
  },
  noticeMutedText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },

  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 56,
  },
  itemText: { flex: 1, gap: 2 },
  itemName: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  itemMeta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  itemAmount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },

  allocationNote: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    lineHeight: 18,
    marginTop: 8,
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 48,
  },
  totalLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  totalValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  grandLabel: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  grandValue: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 48,
  },
  detailLabel: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  detailValue: {
    flexShrink: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },

  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 60,
  },
  supplierIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionBtn: { marginBottom: 10 },
});
