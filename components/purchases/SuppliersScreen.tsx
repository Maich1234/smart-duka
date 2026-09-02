import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ContextualSearchBar } from '@/components/ui/ContextualSearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useAlert } from '@/context/AlertContext';
import { useSearch } from '@/hooks/useSearch';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type Supplier,
} from '@/services/suppliers';
import { formatCurrency, formatDate, formatRelativeTime } from '@/utils/formatters';
import { haptics } from '@/utils/haptics';
import { purchasingBasePath } from '@/utils/purchasingRoutes';
import { isOfflineQueued, mutationErrorMessage } from '@/utils/errors';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const PAGE_SIZE = 20;

interface SupplierFormState {
  name: string;
  phone: string;
  email: string;
  location: string;
  notes: string;
}

const EMPTY_FORM: SupplierFormState = { name: '', phone: '', email: '', location: '', notes: '' };

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

/**
 * Supplier directory — mounted from both (owner)/purchases/suppliers.tsx and
 * (staff)/purchases/suppliers.tsx.
 *
 * Tapping a supplier opens a detail sheet rather than pushing a route: the
 * spend/purchase-count stats it shows are computed on demand by the backend,
 * and the whole point of opening one is to glance and go back.
 *
 * Detail and the add/edit form are one BottomSheet whose content swaps by
 * mode, never two stacked ones — RN Modals cross-fading on Android flicker,
 * which is the same reason SupplierPickerSheet keeps its "create" step inline.
 */
export function SuppliersScreen() {
  const role = useAuthStore((s: AuthState) => s.user?.role);
  const currency = useAuthStore((s: AuthState) => s.user?.shop?.currency);
  const base = purchasingBasePath(role);
  const tabBarHeight = useTabBarHeight();
  const queryClient = useQueryClient();
  const { alert, toast } = useAlert();

  const canView = usePermission('view_purchases');
  const canCreate = usePermission('create_purchases');
  const canEdit = usePermission('edit_purchases');
  const canDelete = usePermission('delete_purchases');

  // A purchase's supplier row deep-links here with the sheet pre-opened.
  const { supplierId: deepLinkedSupplierId } = useLocalSearchParams<{ supplierId?: string }>();

  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkedSupplierId ?? null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM);

  // One sheet, three contents. 'create' has no selectedId, so opening the form
  // from the empty state works without a supplier in hand.
  const sheetOpen = !!selectedId || !!formMode;

  const {
    value: searchValue,
    query: searchQuery,
    onChange: onSearchChange,
    onSubmit: onSearchSubmit,
    selectRecent,
    recentSearches,
    clearRecent,
    isSearching,
  } = useSearch('suppliers');

  const { data, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['suppliers', searchQuery, page],
    queryFn: () => getSuppliers({ search: searchQuery || undefined, page, limit: PAGE_SIZE }),
    enabled: canView,
    // Keeps the current page on screen while the next one loads, instead of
    // blanking the list (and the search box with it) between keystrokes.
    placeholderData: keepPreviousData,
  });

  const { data: detailData, isLoading: loadingDetail, isError: detailError, refetch: refetchDetail } = useQuery({
    queryKey: ['supplier', selectedId],
    queryFn: () => getSupplierById(selectedId!),
    enabled: !!selectedId,
  });

  const suppliers = data?.data ?? [];
  const totalPages = data?.pagination?.pages ?? 1;
  const total = data?.pagination?.total ?? 0;
  const detail = detailData?.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ['supplier', selectedId] });
  };

  /** Leaves the form. From 'edit' that lands back on the detail it came from. */
  const closeForm = () => {
    setFormMode(null);
    setForm(EMPTY_FORM);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      return formMode === 'edit' && selectedId
        ? updateSupplier(selectedId, payload)
        : createSupplier(payload);
    },
    onSuccess: (res) => {
      const created = formMode === 'create';
      closeForm();
      invalidate();
      if (created) setPage(1);
      toast({ type: 'success', message: res.message || (created ? 'Supplier added' : 'Supplier updated') });
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        closeForm();
        toast({ type: 'info', message: 'Supplier saved offline. Will sync when connected.' });
        return;
      }
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not save supplier') });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: (res) => {
      setSelectedId(null);
      invalidate();
      toast({ type: 'success', message: res.message || 'Supplier removed' });
    },
    onError: (error: any) => {
      // /suppliers isn't in api.ts's REALTIME_ONLY list, so an offline delete
      // is queued, not lost. Reporting it as a failure would have the owner
      // retry a removal that is already on its way.
      if (isOfflineQueued(error)) {
        setSelectedId(null);
        toast({ type: 'info', message: 'Removal will sync when connected.' });
        return;
      }
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not remove supplier') });
    },
  });

  /** Dismisses the sheet entirely, from whichever mode it's in. */
  const closeSheet = () => {
    if (saveMutation.isPending) return;
    setFormMode(null);
    setForm(EMPTY_FORM);
    setSelectedId(null);
  };

  const openCreate = () => {
    haptics.light();
    setForm(EMPTY_FORM);
    setFormMode('create');
  };

  const openEdit = (supplier: Supplier) => {
    haptics.light();
    setForm({
      name: supplier.name,
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      location: supplier.location ?? '',
      notes: supplier.notes ?? '',
    });
    setFormMode('edit');
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ type: 'error', message: 'Enter a supplier name' });
      return;
    }
    saveMutation.mutate();
  };

  const handleDelete = (supplier: Supplier) => {
    alert({
      type: 'confirm',
      title: `Remove ${supplier.name}?`,
      // Soft delete on the backend — say so, or the owner will assume their
      // purchase history is about to lose its supplier names.
      message: 'They will no longer appear when recording a purchase. Past purchases keep their name.',
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Remove', variant: 'danger', onPress: () => deleteMutation.mutate(supplier._id) },
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

  if (isLoading && suppliers.length === 0) {
    return <ListSkeleton rows={6} showSearch />;
  }

  if (isError && suppliers.length === 0) {
    return <QueryError onRetry={refetch} />;
  }

  return (
    <View style={styles.flex}>
      <ContextualSearchBar
        value={searchValue}
        onChangeText={onSearchChange}
        onSubmit={onSearchSubmit}
        recentSearches={recentSearches}
        onSelectRecent={selectRecent}
        onClearRecent={clearRecent}
        placeholder="Search suppliers…"
        style={styles.searchBar}
      />

      {canCreate && (
        <View style={styles.addWrap}>
          <Button title="Add Supplier" leftIcon="add" onPress={openCreate} size="sm" />
        </View>
      )}

      <FlashList
        showsVerticalScrollIndicator={false}
        data={suppliers}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <AnimatedPressable
            style={styles.card}
            onPress={() => {
              haptics.light();
              setSelectedId(item._id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.name}`}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(item.name)}</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {[item.phone, item.location].filter(Boolean).join(' · ') || 'No contact details'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </AnimatedPressable>
        )}
        contentContainerStyle={{
          paddingHorizontal: Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListHeaderComponent={
          total > 0 ? (
            <Text style={styles.resultCount}>
              {total} supplier{total === 1 ? '' : 's'}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          isSearching ? (
            <View style={styles.emptySearch}>
              <Ionicons name="search-outline" size={36} color={Colors.textTertiary} />
              <Text style={styles.emptySearchTitle}>No suppliers found</Text>
              <Text style={styles.emptySearchSub}>Nothing matches “{searchValue}”.</Text>
            </View>
          ) : (
            <EmptyState
              title="No suppliers yet"
              subtitle="Add the people you buy stock from to track what you spend with each of them."
            />
          )
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.paginationBar}>
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

      {/* ── Detail / add / edit — one sheet, content by mode ───────── */}
      <BottomSheet visible={sheetOpen} onClose={closeSheet}>
        {formMode ? (
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {formMode === 'edit' ? 'Edit supplier' : 'Add supplier'}
            </Text>
            <Input
              label="Name"
              placeholder="e.g. Mama Njeri Wholesalers"
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
            />
            <Input
              label="Phone (optional)"
              placeholder="07…"
              value={form.phone}
              onChangeText={(phone) => setForm((f) => ({ ...f, phone }))}
              keyboardType="phone-pad"
            />
            <Input
              label="Email (optional)"
              value={form.email}
              onChangeText={(email) => setForm((f) => ({ ...f, email }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Location (optional)"
              placeholder="e.g. Gikomba"
              value={form.location}
              onChangeText={(location) => setForm((f) => ({ ...f, location }))}
            />
            <Input
              label="Notes (optional)"
              placeholder="Delivery days, credit terms…"
              value={form.notes}
              onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
              multiline
            />
            <Button
              title={formMode === 'edit' ? 'Save changes' : 'Add supplier'}
              onPress={handleSave}
              loading={saveMutation.isPending}
              style={styles.sheetBtn}
            />
            <Button
              title={formMode === 'edit' ? 'Back' : 'Cancel'}
              variant="ghost"
              onPress={formMode === 'edit' ? closeForm : closeSheet}
              disabled={saveMutation.isPending}
            />
          </View>
        ) : (
          <View style={styles.sheet}>
            {loadingDetail ? (
              <ActivityIndicator color={Colors.primary} style={styles.sheetLoading} />
            ) : detailError || !detail ? (
              <QueryError onRetry={refetchDetail} message="Could not load this supplier. Check your connection and try again." />
            ) : (
              <>
                <View style={styles.sheetHeader}>
                  <View style={styles.avatarLarge}>
                    <Text style={styles.avatarLargeText}>{initials(detail.name)}</Text>
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.sheetTitle} numberOfLines={2}>{detail.name}</Text>
                    {!detail.isActive && <Text style={styles.inactiveTag}>Removed from the picker</Text>}
                  </View>
                </View>

                <View style={styles.statGrid}>
                  <View style={styles.statTile}>
                    <Text style={styles.statValue}>{detail.stats.purchaseCount}</Text>
                    <Text style={styles.statLabel}>Purchases</Text>
                  </View>
                  <View style={styles.statTile}>
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                      {formatCurrency(detail.stats.totalSpend, currency)}
                    </Text>
                    <Text style={styles.statLabel}>Total spend</Text>
                  </View>
                  <View style={styles.statTile}>
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                      {formatCurrency(detail.stats.averagePurchaseCost, currency)}
                    </Text>
                    <Text style={styles.statLabel}>Average</Text>
                  </View>
                  <View style={styles.statTile}>
                    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                      {detail.stats.lastPurchaseDate ? formatRelativeTime(detail.stats.lastPurchaseDate) : 'Never'}
                    </Text>
                    <Text style={styles.statLabel}>Last purchase</Text>
                  </View>
                </View>

                {(detail.phone || detail.email || detail.location || detail.notes) && (
                  <View style={styles.contactCard}>
                    {!!detail.phone && (
                      <View style={styles.contactRow}>
                        <Ionicons name="call-outline" size={15} color={Colors.textTertiary} />
                        <Text style={styles.contactText}>{detail.phone}</Text>
                      </View>
                    )}
                    {!!detail.email && (
                      <View style={styles.contactRow}>
                        <Ionicons name="mail-outline" size={15} color={Colors.textTertiary} />
                        <Text style={styles.contactText}>{detail.email}</Text>
                      </View>
                    )}
                    {!!detail.location && (
                      <View style={styles.contactRow}>
                        <Ionicons name="location-outline" size={15} color={Colors.textTertiary} />
                        <Text style={styles.contactText}>{detail.location}</Text>
                      </View>
                    )}
                    {!!detail.notes && (
                      <View style={styles.contactRow}>
                        <Ionicons name="document-text-outline" size={15} color={Colors.textTertiary} />
                        <Text style={styles.contactText}>{detail.notes}</Text>
                      </View>
                    )}
                  </View>
                )}

                {detail.recentPurchases.length > 0 && (
                  <>
                    <Text style={styles.sheetSectionLabel}>RECENT PURCHASES</Text>
                    <View style={styles.recentCard}>
                      {detail.recentPurchases.map((purchase, index) => (
                        <AnimatedPressable
                          key={purchase._id}
                          style={[
                            styles.recentRow,
                            index < detail.recentPurchases.length - 1 && styles.recentRowBorder,
                          ]}
                          onPress={() => {
                            setSelectedId(null);
                            router.push(`${base}/${purchase._id}` as never);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Purchase on ${formatDate(purchase.createdAt)}`}
                        >
                          <Text style={styles.recentDate}>{formatDate(purchase.createdAt)}</Text>
                          <Text style={styles.recentAmount}>
                            {formatCurrency(purchase.grandTotal, currency)}
                          </Text>
                          <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
                        </AnimatedPressable>
                      ))}
                    </View>
                  </>
                )}

                {canEdit && (
                  <Button
                    title="Edit details"
                    variant="outline"
                    leftIcon="pencil-outline"
                    onPress={() => openEdit(detail)}
                    style={styles.sheetBtn}
                  />
                )}
                {canDelete && detail.isActive && (
                  <Button
                    title="Remove supplier"
                    variant="ghost"
                    onPress={() => handleDelete(detail)}
                    loading={deleteMutation.isPending}
                  />
                )}
              </>
            )}
          </View>
        )}
      </BottomSheet>
    </View>
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

  searchBar: { marginHorizontal: Spacing.md, marginTop: Spacing.md },
  addWrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, alignItems: 'flex-start' },

  resultCount: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    marginBottom: 10,
    minHeight: 68,
    ...Shadows.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  cardText: { flex: 1, gap: 2 },
  cardName: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  cardMeta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },

  emptySearch: { alignItems: 'center', paddingTop: Spacing.xl, gap: 6 },
  emptySearchTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  emptySearchSub: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },

  // ── Sheets
  sheet: { padding: Spacing.lg, gap: Spacing.sm },
  sheetLoading: { paddingVertical: Spacing.xl },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  sheetTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  inactiveTag: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.danger,
  },

  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.xs,
  },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: 12,
    gap: 2,
  },
  statValue: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },

  contactCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: 12,
    gap: 8,
    marginTop: Spacing.xs,
  },
  contactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  contactText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  sheetSectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginTop: Spacing.sm,
  },
  recentCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 44,
  },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  recentDate: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  recentAmount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },

  sheetBtn: { marginTop: Spacing.sm },
});
