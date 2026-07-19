import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { getShopConfig } from '@/services/shop';
import { getPurchaseStats } from '@/services/purchases';
import { formatCurrency, formatRelativeTime } from '@/utils/formatters';
import { haptics } from '@/utils/haptics';
import { purchasingBasePath } from '@/utils/purchasingRoutes';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

interface StatTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tint: string;
  tintBg: string;
}

const StatTile: React.FC<StatTileProps> = ({ icon, label, value, tint, tintBg }) => (
  <View style={styles.statTile}>
    <View style={[styles.statIconWrap, { backgroundColor: tintBg }]}>
      <Ionicons name={icon} size={16} color={tint} />
    </View>
    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
  </View>
);

interface ActionTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}

const ActionTile: React.FC<ActionTileProps> = ({ icon, title, onPress }) => (
  <AnimatedPressable style={styles.actionTile} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
    <View style={styles.actionIconWrap}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
    </View>
    <Text style={styles.actionTileText} numberOfLines={1}>{title}</Text>
  </AnimatedPressable>
);

/**
 * Purchasing home dashboard — mounted from both (owner)/purchases/index.tsx
 * and (staff)/purchases/index.tsx (one component, role-derived routes),
 * mirroring how ExpensesScreen is shared across both route groups.
 */
export function PurchasingHomeScreen() {
  const role = useAuthStore((s: AuthState) => s.user?.role);
  const base = purchasingBasePath(role);
  const tabBarHeight = useBottomTabBarHeight();
  const canView = usePermission('view_purchases');
  const canCreate = usePermission('create_purchases');

  const { data: shopConfigData, isLoading: loadingShopConfig } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });
  const purchasingEnabled = shopConfigData?.data?.purchasingEnabled ?? false;

  const { data, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['purchaseStats'],
    queryFn: getPurchaseStats,
    enabled: canView && purchasingEnabled,
  });

  const go = (path: string) => {
    haptics.light();
    router.push(path as never);
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

  if (loadingShopConfig) {
    return <ListSkeleton rows={3} heroHeight={140} />;
  }

  if (!purchasingEnabled) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="cart-outline" size={40} color={Colors.textTertiary} />
        <Text style={styles.centerTitle}>Purchasing isn&apos;t turned on yet</Text>
        <Text style={styles.centerSub}>
          {role === 'owner'
            ? 'Turn on the Purchasing Module in Profile → Preferences to start recording stock purchases.'
            : 'Ask your shop owner to turn on the Purchasing Module.'}
        </Text>
        {role === 'owner' && (
          <AnimatedPressable style={styles.enableBtn} onPress={() => go('/(owner)/profile')}>
            <Text style={styles.enableBtnText}>Go to Settings</Text>
          </AnimatedPressable>
        )}
      </View>
    );
  }

  if (isLoading) {
    return <ListSkeleton rows={4} heroHeight={140} />;
  }

  const stats = data?.data;
  if (isError && !stats) {
    return <QueryError onRetry={refetch} />;
  }

  const recent = stats?.recentPurchases ?? [];

  return (
    <ScrollView
      style={styles.flex}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.md }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} colors={[Colors.primary]} />
      }
    >
      <View style={styles.statsGrid}>
        <StatTile icon="cart-outline" label="Today's Purchases" value={String(stats?.purchaseCount ?? 0)} tint={Colors.primary} tintBg={Colors.primarySubtle} />
        <StatTile icon="cash-outline" label="Today's Spend" value={formatCurrency(stats?.totalSpend ?? 0)} tint={Colors.accentDark} tintBg={Colors.accentSubtle} />
        <StatTile icon="cube-outline" label="Products Purchased" value={String(stats?.productsPurchased ?? 0)} tint={Colors.info} tintBg="#DBEAFE" />
        <StatTile icon="business-outline" label="Suppliers Used" value={String(stats?.suppliersUsed ?? 0)} tint={Colors.success} tintBg={Colors.successSubtle} />
      </View>

      <View style={styles.actionsSection}>
        {canCreate && (
          <AnimatedPressable
            style={styles.primaryBtn}
            onPress={() => go(`${base}/new`)}
            accessibilityRole="button"
            accessibilityLabel="Create Purchase"
          >
            <View style={styles.primaryIconWrap}>
              <Ionicons name="add" size={20} color={Colors.white} />
            </View>
            <Text style={styles.primaryBtnText}>Create Purchase</Text>
            <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.85)" />
          </AnimatedPressable>
        )}
        <View style={styles.tileRow}>
          <ActionTile icon="time-outline" title="History" onPress={() => go(`${base}/history`)} />
          <ActionTile icon="people-outline" title="Suppliers" onPress={() => go(`${base}/suppliers`)} />
          <ActionTile icon="bar-chart-outline" title="Reports" onPress={() => go(`${base}/reports`)} />
        </View>
      </View>

      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>RECENT PURCHASES</Text>
          {recent.length > 0 && (
            <AnimatedPressable
              onPress={() => go(`${base}/history`)}
              style={styles.viewAll}
              accessibilityRole="button"
              accessibilityLabel="View all purchases"
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
            </AnimatedPressable>
          )}
        </View>

        {recent.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState title="No purchases yet" subtitle="Record your first stock purchase to see it here." />
          </View>
        ) : (
          <View style={styles.recentCard}>
            {recent.map((purchase, index) => (
              <AnimatedPressable
                key={purchase._id}
                onPress={() => go(`${base}/${purchase._id}`)}
                style={[styles.recentRow, index < recent.length - 1 && styles.recentRowBorder]}
                accessibilityRole="button"
                accessibilityLabel={`Purchase from ${purchase.supplierName || 'walk-in supplier'}`}
              >
                <View style={styles.recentIconWrap}>
                  <Ionicons name="cart-outline" size={16} color={Colors.primary} />
                </View>
                <View style={styles.recentText}>
                  <Text style={styles.recentSupplier} numberOfLines={1}>
                    {purchase.supplierName || 'Walk-in purchase'}
                  </Text>
                  <Text style={styles.recentMeta} numberOfLines={1}>
                    {formatRelativeTime(purchase.createdAt)} · {purchase.items.length} item{purchase.items.length === 1 ? '' : 's'}
                  </Text>
                </View>
                {purchase.grandTotal != null && (
                  <Text style={styles.recentAmount}>{formatCurrency(purchase.grandTotal)}</Text>
                )}
                {purchase.status === 'pending_approval' && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                )}
              </AnimatedPressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },

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
  enableBtn: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
  },
  enableBtnText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.white,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: 10,
    marginBottom: Spacing.md,
  },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
    ...Shadows.sm,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },

  // Actions
  actionsSection: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 56,
    ...Shadows.md,
  },
  primaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.white,
    letterSpacing: -0.2,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionTile: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingVertical: 14,
    minHeight: 72,
    ...Shadows.sm,
  },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTileText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },

  // Recent purchases
  recentSection: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recentTitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingLeft: 12,
    minHeight: 32,
  },
  viewAllText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  recentCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 60,
  },
  recentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  recentIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentText: {
    flex: 1,
    gap: 2,
  },
  recentSupplier: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  recentMeta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  recentAmount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  pendingBadge: {
    backgroundColor: Colors.warningSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#B45309',
  },
});
