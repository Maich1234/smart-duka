import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Share } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAlert } from '@/context/AlertContext';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { usePermission } from '@/utils/permissions';
import { useAuthStore } from '@/store/authStore';
import { openWebPage } from '@/utils/openWebPage';
import { haptics } from '@/utils/haptics';
import {
  getQuotations,
  declineQuotation,
  deleteQuotation,
  type Quotation,
} from '@/services/quotations';
import { mutationErrorMessage } from '@/utils/errors';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { PUBLIC_WEB_URL } from '@/constants/config';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';
import { Motion } from '@/constants/Motion';

interface QuotationsListScreenProps {
  /** Where "New Quotation" and "Convert to Sale" lead — differs only by
   * route group between owner and staff, same shape as CustomerListScreen's
   * and CreateQuotationScreen's basePath. */
  basePath: '/(owner)/quotations' | '/(staff)/quotations';
}

type StatusFilter = 'all' | Quotation['status'];

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'declined', label: 'Declined' },
  { value: 'converted', label: 'Converted' },
];

const STATUS_STYLE: Record<Quotation['status'], { label: string; bg: string; fg: string }> = {
  draft: { label: 'Draft', bg: Colors.primarySubtle, fg: Colors.primaryDark },
  declined: { label: 'Declined', bg: Colors.dangerSubtle, fg: Colors.danger },
  converted: { label: 'Converted', bg: Colors.successSubtle, fg: Colors.success },
};

const isExpiredDraft = (q: Quotation) => q.status === 'draft' && new Date(q.validUntil) < new Date();

/**
 * Closes the actions sheet, then runs `fn` after its close animation —
 * every action here opens something else that's also a native modal
 * (WebBrowser, the OS share sheet, expo-router's push, or this screen's own
 * confirm alert), and presenting one of those while our sheet's Modal is
 * still up is the classic "two modals at once" glitch on both platforms.
 */
const ACTIONS_SHEET_CLOSE_MS = 300;

interface QuotationRowProps {
  quotation: Quotation;
  currency?: string;
  onPress: () => void;
  isLast: boolean;
}

const QuotationRow: React.FC<QuotationRowProps> = ({ quotation, currency, onPress, isLast }) => {
  const status = STATUS_STYLE[quotation.status];
  const expired = isExpiredDraft(quotation);

  return (
    <AnimatedPressable
      style={[styles.row, !isLast && styles.divider]}
      onPress={onPress}
      pressScale={Motion.press.scaleCard}
      accessibilityRole="button"
      accessibilityLabel={`${quotation.quoteNumber}, ${quotation.customerSnapshot.name}, ${formatCurrency(quotation.total, currency)}, ${status.label}${expired ? ', expired' : ''}`}
      accessibilityHint="Opens actions for this quotation"
    >
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.quoteNumber} numberOfLines={1}>{quotation.quoteNumber}</Text>
          <View style={[styles.pill, { backgroundColor: status.bg }]}>
            <Text style={[styles.pillText, { color: status.fg }]}>{status.label}</Text>
          </View>
          {expired && (
            <View style={[styles.pill, { backgroundColor: Colors.warningSubtle }]}>
              <Text style={[styles.pillText, { color: Colors.warningDark }]}>Expired</Text>
            </View>
          )}
        </View>
        <Text style={styles.customerName} numberOfLines={1}>{quotation.customerSnapshot.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{formatDate(quotation.createdAt)}</Text>
      </View>

      <View style={styles.amountWrap}>
        <Text style={styles.amount} numberOfLines={1}>{formatCurrency(quotation.total, currency)}</Text>
        <Ionicons name="ellipsis-horizontal" size={16} color={Colors.textTertiary} />
      </View>
    </AnimatedPressable>
  );
};

interface ActionRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: 'default' | 'danger';
  onPress: () => void;
}

const ActionRow: React.FC<ActionRowProps> = ({ icon, label, tone = 'default', onPress }) => (
  <AnimatedPressable
    style={styles.actionRow}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Ionicons name={icon} size={18} color={tone === 'danger' ? Colors.danger : Colors.textPrimary} />
    <Text style={[styles.actionLabel, tone === 'danger' && styles.actionLabelDanger]}>{label}</Text>
  </AnimatedPressable>
);

/**
 * The quotations list: filter by status, open a quotation's actions
 * (View / Share link / Convert to Sale / Decline / Delete) from a bottom
 * sheet rather than crowding the row with icon buttons — mirrors
 * CreditTransactionRow's "tap opens options" convention rather than
 * CustomerListScreen's "tap navigates" one, since there's no detail screen
 * to drill into here.
 */
export const QuotationsListScreen: React.FC<QuotationsListScreenProps> = ({ basePath }) => {
  const tabBarHeight = useTabBarHeight();
  const currency = useAuthStore((s) => s.user?.shop?.currency);
  const { alert, toast } = useAlert();
  const queryClient = useQueryClient();
  const canCreate = usePermission('create_quotation');
  const canConvert = usePermission('convert_quotation_to_sale');

  const [filter, setFilter] = useState<StatusFilter>('all');
  // Kept separate from `actionsVisible` (rather than nulled on close) so the
  // sheet's content stays on screen through its own close animation instead
  // of vanishing a beat before the sheet finishes sliding away — the same
  // "hold the data, toggle a separate visible flag" shape every other sheet
  // in this app already uses.
  const [actionsFor, setActionsFor] = useState<Quotation | null>(null);
  const [actionsVisible, setActionsVisible] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['quotations', filter],
    queryFn: () => getQuotations(filter === 'all' ? undefined : filter),
  });

  // getQuotations() resolves to the full {success, data, pagination} envelope,
  // not a bare array — read .data for the list itself.
  const quotations = data?.data ?? [];

  const declineMutation = useMutation({
    mutationFn: (id: string) => declineQuotation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast({ type: 'success', message: 'Quotation declined.' });
    },
    onError: (error) => {
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not decline the quotation') });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuotation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast({ type: 'success', message: 'Quotation deleted.' });
    },
    onError: (error) => {
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not delete the quotation') });
    },
  });

  const openActions = (quotation: Quotation) => {
    haptics.light();
    setActionsFor(quotation);
    setActionsVisible(true);
  };

  const closeActionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (closeActionsTimeoutRef.current) clearTimeout(closeActionsTimeoutRef.current);
  }, []);

  const closeActionsThen = (fn: () => void) => {
    setActionsVisible(false);
    closeActionsTimeoutRef.current = setTimeout(fn, ACTIONS_SHEET_CLOSE_MS);
  };

  const shareQuotation = async (quotation: Quotation) => {
    try {
      await Share.share({
        message: `Quotation ${quotation.quoteNumber} for ${quotation.customerSnapshot.name}: ${PUBLIC_WEB_URL}/q/${quotation.publicToken}`,
      });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  const confirmDecline = (quotation: Quotation) => {
    alert({
      type: 'confirm',
      title: 'Decline this quotation?',
      message: `${quotation.customerSnapshot.name} will no longer be able to accept ${quotation.quoteNumber}.`,
      buttons: [
        { label: 'Never mind', variant: 'ghost' },
        { label: 'Decline', variant: 'danger', onPress: () => declineMutation.mutate(quotation._id) },
      ],
    });
  };

  const confirmDelete = (quotation: Quotation) => {
    alert({
      type: 'confirm',
      title: 'Delete this quotation?',
      message: `${quotation.quoteNumber} will be permanently removed. This cannot be undone.`,
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Delete', variant: 'danger', onPress: () => deleteMutation.mutate(quotation._id) },
      ],
    });
  };

  const renderQuotation = useCallback(
    ({ item, index }: { item: Quotation; index: number }) => (
      <QuotationRow
        quotation={item}
        currency={currency}
        isLast={index === quotations.length - 1}
        onPress={() => openActions(item)}
      />
    ),
    [currency, quotations.length],
  );

  return (
    <View style={styles.flex}>
      <ScreenHeader
        title="Quotations"
        showBack={false}
      />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <AnimatedPressable
              key={f.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => { haptics.light(); setFilter(f.value); }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${f.label} quotations`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                {f.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {isLoading ? (
        <ListSkeleton rows={6} showSearch={false} />
      ) : isError ? (
        <QueryError onRetry={refetch} />
      ) : quotations.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No quotations yet' : `No ${filter} quotations`}
          subtitle={filter === 'all' ? 'Quotations you create for customers appear here.' : 'Try a different filter.'}
        />
      ) : (
        <FlatList
          data={quotations}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xxl }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          renderItem={renderQuotation}
        />
      )}

      {canCreate && (
        <AnimatedPressable
          style={[styles.fab, { bottom: tabBarHeight + Spacing.md }]}
          onPress={() => { haptics.light(); router.push(`${basePath}/new` as never); }}
          accessibilityRole="button"
          accessibilityLabel="New quotation"
        >
          <Ionicons name="add" size={26} color={Colors.white} />
        </AnimatedPressable>
      )}

      <BottomSheet visible={actionsVisible} onClose={() => setActionsVisible(false)}>
        {actionsFor && (
          <View style={styles.actionsSheet}>
            <Text style={styles.actionsTitle} numberOfLines={1}>{actionsFor.quoteNumber}</Text>
            <Text style={styles.actionsSubtitle} numberOfLines={1}>
              {actionsFor.customerSnapshot.name} · {formatCurrency(actionsFor.total, currency)}
            </Text>

            <ActionRow
              icon="eye-outline"
              label="View"
              onPress={() => {
                const quotation = actionsFor;
                closeActionsThen(() => openWebPage(`${PUBLIC_WEB_URL}/q/${quotation.publicToken}`));
              }}
            />
            <ActionRow
              icon="share-outline"
              label="Share link"
              onPress={() => {
                const quotation = actionsFor;
                closeActionsThen(() => shareQuotation(quotation));
              }}
            />
            {actionsFor.status === 'draft' && canConvert && (
              <ActionRow
                icon="swap-horizontal-outline"
                label="Convert to Sale"
                onPress={() => {
                  const quotation = actionsFor;
                  closeActionsThen(() => router.push(`${basePath}/${quotation._id}/convert` as never));
                }}
              />
            )}
            {actionsFor.status === 'draft' && (
              <ActionRow
                icon="close-circle-outline"
                label="Decline"
                onPress={() => {
                  const quotation = actionsFor;
                  closeActionsThen(() => confirmDecline(quotation));
                }}
              />
            )}
            {(actionsFor.status === 'draft' || actionsFor.status === 'declined') && (
              <ActionRow
                icon="trash-outline"
                label="Delete"
                tone="danger"
                onPress={() => {
                  const quotation = actionsFor;
                  closeActionsThen(() => confirmDelete(quotation));
                }}
              />
            )}
          </View>
        )}
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },

  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    minHeight: 64,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quoteNumber: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm },
  pillText: { fontSize: 10, fontFamily: Typography.fontFamilySemiBold },
  customerName: { fontSize: Typography.size.body, fontFamily: Typography.fontFamily, color: Colors.textPrimary, marginTop: 2 },
  meta: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 1 },

  amountWrap: { alignItems: 'flex-end', gap: 4 },
  amount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    fontVariant: ['tabular-nums'],
    color: Colors.textPrimary,
  },

  fab: {
    position: 'absolute',
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },

  actionsSheet: { paddingBottom: Spacing.sm },
  actionsTitle: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  actionsSubtitle: { fontSize: Typography.size.small, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.sm },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  actionLabel: { fontSize: Typography.size.body, fontFamily: Typography.fontFamily, color: Colors.textPrimary },
  actionLabelDanger: { color: Colors.danger },
});
