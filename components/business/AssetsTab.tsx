import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { Shimmer } from '@/components/ui/Shimmer';
import { QueryError } from '@/components/ui/QueryError';
import { useAlert } from '@/context/AlertContext';
import { isOfflineQueued, mutationErrorMessage } from '@/utils/errors';
import { haptics } from '@/utils/haptics';
import { formatDate } from '@/utils/formatters';
import { AssetFormSheet } from './AssetFormSheet';
import { SectionTitle, StatRow, Divider, Panel, InfoNote, EmptyNote, money } from './BusinessPrimitives';
import {
  getAssets, createAsset, updateAsset,
  ASSET_CATEGORY_LABELS, ASSET_STATUS_LABELS,
  type Asset, type CreateAssetData,
} from '@/services/assets';
import type { CapitalPosition } from '@/services/business';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface Props {
  capital?: CapitalPosition;
  currency?: string;
}

/**
 * What the business owns and uses to trade.
 *
 * Nothing lands here automatically. A purchase is a stock movement and a
 * power bill is an expense; neither becomes an asset because it was
 * expensive. The owner puts things here deliberately, which is also why the
 * list can be empty and still be correct.
 */
export const AssetsTab: React.FC<Props> = ({ capital, currency }) => {
  const queryClient = useQueryClient();
  const { toast } = useAlert();
  const [showArchived, setShowArchived] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['assets', showArchived],
    queryFn: () => getAssets({ includeArchived: showArchived, limit: 100 }),
  });

  // The header's capital figure is derived from these rows, so it has to be
  // refetched alongside them — otherwise adding a fridge leaves the owner
  // looking at a capital total that hasn't moved.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['businessOverview'] });
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditing(null);
  };

  const saveMutation = useMutation({
    mutationFn: (payload: CreateAssetData) =>
      editing ? updateAsset(editing._id, payload) : createAsset(payload),
    onSuccess: () => {
      invalidate();
      toast({ type: 'success', message: editing ? 'Asset updated' : 'Asset added' });
      closeForm();
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        closeForm();
        toast({ type: 'info', message: 'Saved offline. Will sync when connected.' });
        return;
      }
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not save asset') });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => updateAsset(id, { archived }),
    onSuccess: (_res, vars) => {
      invalidate();
      toast({ type: 'success', message: vars.archived ? 'Asset removed' : 'Asset restored' });
      closeForm();
    },
    onError: (error: any) => {
      if (isOfflineQueued(error)) {
        closeForm();
        toast({ type: 'info', message: 'Saved offline. Will sync when connected.' });
        return;
      }
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not update asset') });
    },
  });

  const assets = data?.data ?? [];
  // A duka's asset list is a handful of rows, so there is no paging control
  // here — but truncating silently at the page cap would be a lie, so say so.
  const notShown = Math.max((data?.pagination.total ?? 0) - assets.length, 0);

  return (
    <View style={s.root}>
      <Panel>
        <StatRow
          label="Estimated value"
          value={money(capital?.assets.estimatedValue ?? 0, currency)}
          emphasis
        />
        <Divider />
        <StatRow label="Originally paid" value={money(capital?.assets.acquisitionValue ?? 0, currency)} />
        <Divider />
        <StatRow
          label="Assets recorded"
          value={String(capital?.assets.count ?? 0)}
        />
      </Panel>

      {(capital?.assets.unvaluedCount ?? 0) > 0 && (
        <View style={s.note}>
          <InfoNote>
            {`${capital!.assets.unvaluedCount} of these ${capital!.assets.unvaluedCount === 1 ? 'is' : 'are'} counted at what you paid, because no current value has been entered.`}
          </InfoNote>
        </View>
      )}

      <Button
        title="Add asset"
        leftIcon="add"
        onPress={() => { haptics.light(); setEditing(null); setFormVisible(true); }}
        style={s.addBtn}
      />

      <View style={s.gap} />
      <View style={s.listHeader}>
        <SectionTitle>{showArchived ? 'All assets' : 'Your assets'}</SectionTitle>
        <AnimatedPressable
          onPress={() => { haptics.light(); setShowArchived((v) => !v); }}
          style={s.toggle}
          accessibilityRole="button"
          accessibilityState={{ selected: showArchived }}
          accessibilityLabel={showArchived ? 'Hide removed assets' : 'Show removed assets'}
        >
          <Text style={s.toggleText}>{showArchived ? 'Hide removed' : 'Show removed'}</Text>
        </AnimatedPressable>
      </View>

      {isError && assets.length === 0 ? (
        <QueryError onRetry={refetch} />
      ) : isLoading ? (
        <Shimmer height={180} borderRadius={BorderRadius.md} />
      ) : assets.length === 0 ? (
        <EmptyNote>
          Nothing here yet. Add what your shop owns — a fridge, shelves, a scale, the receipt printer —
          and it will count towards your capital.
        </EmptyNote>
      ) : (
        <View style={s.list}>
          {assets.map((asset) => (
            <AssetRow
              key={asset._id}
              asset={asset}
              currency={currency}
              onPress={() => { haptics.light(); setEditing(asset); setFormVisible(true); }}
            />
          ))}
        </View>
      )}

      {notShown > 0 && (
        <View style={s.note}>
          <InfoNote>{`Showing the ${assets.length} most recent. ${notShown} more are recorded but not listed here.`}</InfoNote>
        </View>
      )}

      <View style={s.gap} />
      <InfoNote>
        Assets are things your shop owns and uses. Goods you sell are counted under Stock, and money
        spent running the shop belongs in Expenses.
      </InfoNote>

      <AssetFormSheet
        visible={formVisible}
        onClose={closeForm}
        asset={editing}
        loading={saveMutation.isPending || archiveMutation.isPending}
        onSave={(payload) => saveMutation.mutate(payload)}
        onArchiveToggle={
          editing
            ? () => archiveMutation.mutate({ id: editing._id, archived: !editing.archivedAt })
            : undefined
        }
      />
    </View>
  );
};

const AssetRow: React.FC<{ asset: Asset; currency?: string; onPress: () => void }> = ({
  asset, currency, onPress,
}) => {
  const archived = !!asset.archivedAt;
  const detail = [
    ASSET_CATEGORY_LABELS[asset.category],
    asset.quantity > 1 ? `${asset.quantity} items` : null,
    asset.status !== 'active' ? ASSET_STATUS_LABELS[asset.status] : null,
    formatDate(asset.acquisitionDate),
  ].filter(Boolean).join(' · ');

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[s.row, archived && s.rowArchived]}
      pressScale={0.995}
      accessibilityRole="button"
      accessibilityLabel={`${asset.name}, ${money(asset.estimatedValue, currency)}. Edit.`}
    >
      <View style={s.rowText}>
        <Text style={s.rowName} numberOfLines={1}>{asset.name}</Text>
        <Text style={s.rowDetail} numberOfLines={1}>{archived ? `Removed · ${detail}` : detail}</Text>
      </View>
      <View style={s.rowValueWrap}>
        <Text style={s.rowValue}>{money(asset.estimatedValue, currency)}</Text>
        {/* Says which number this came from, every time — the difference
            between an owner's estimate and a stand-in purchase price is the
            whole honesty of the figure above. */}
        <Text style={s.rowBasis}>
          {asset.valueBasis === 'current' ? 'worth now' : 'what you paid'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
    </AnimatedPressable>
  );
};

const s = StyleSheet.create({
  root: { paddingTop: Spacing.lg },
  gap: { marginTop: Spacing.xl },
  note: { marginTop: Spacing.md },
  addBtn: { marginTop: Spacing.md },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  toggle: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.sm },
  toggleText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  list: { gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 64,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  rowArchived: { opacity: 0.55 },
  rowText: { flex: 1, gap: 2 },
  rowName: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  rowDetail: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  rowValueWrap: { alignItems: 'flex-end', gap: 1 },
  rowValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  rowBasis: {
    // 11, not 10: PRODUCT.md's floor for legible type, and this line is the
    // difference between an owner's estimate and a stand-in purchase price.
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
});
