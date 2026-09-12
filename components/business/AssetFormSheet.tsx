import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { DatePicker } from '@/components/ui/DatePicker';
import { useAlert } from '@/context/AlertContext';
import { haptics } from '@/utils/haptics';
import { formatDate } from '@/utils/formatters';
import {
  ASSET_CATEGORY_LABELS,
  ASSET_STATUS_LABELS,
  type Asset,
  type AssetCategory,
  type AssetStatus,
  type CreateAssetData,
} from '@/services/assets';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface AssetFormSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: CreateAssetData) => void;
  onArchiveToggle?: () => void;
  asset?: Asset | null;
  loading?: boolean;
}

const CATEGORY_ICONS: Record<AssetCategory, keyof typeof Ionicons.glyphMap> = {
  equipment: 'construct-outline',
  furniture: 'bed-outline',
  electronics: 'hardware-chip-outline',
  refrigeration: 'snow-outline',
  fixtures: 'grid-outline',
  transport: 'bicycle-outline',
  other: 'ellipsis-horizontal-outline',
};

const CATEGORIES = Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[];
const STATUSES = Object.keys(ASSET_STATUS_LABELS) as AssetStatus[];

/**
 * Recording something the shop owns.
 *
 * Two things here are deliberate. Values are PER UNIT, labelled as such, so
 * "4 shelves at 4,500" never gets entered as 18,000 and then multiplied
 * again. And "Worth now" is optional: an owner who does not know is told the
 * purchase price will stand in, rather than being made to invent a number
 * that then reads as a valuation.
 */
export const AssetFormSheet: React.FC<AssetFormSheetProps> = ({ visible, onClose, ...rest }) => (
  <BottomSheet visible={visible} onClose={onClose}>
    {/* Mount the body only while open so its useState defaults re-seed from
        `asset` on every open — the same pattern as ExpenseFormSheet, and for
        the same reason: an effect would flash the previous asset for a frame. */}
    {visible && <AssetFormBody onClose={onClose} {...rest} />}
  </BottomSheet>
);

const AssetFormBody: React.FC<Omit<AssetFormSheetProps, 'visible'>> = ({
  onClose,
  onSave,
  onArchiveToggle,
  asset,
  loading = false,
}) => {
  const { toast } = useAlert();
  const [name, setName] = useState(asset?.name ?? '');
  const [category, setCategory] = useState<AssetCategory>(asset?.category ?? 'equipment');
  const [acquisitionValue, setAcquisitionValue] = useState(asset ? String(asset.acquisitionValue) : '');
  const [currentValue, setCurrentValue] = useState(
    asset?.currentValue === null || asset?.currentValue === undefined ? '' : String(asset.currentValue),
  );
  const [quantity, setQuantity] = useState(asset ? String(asset.quantity) : '1');
  const [serialNumber, setSerialNumber] = useState(asset?.serialNumber ?? '');
  const [notes, setNotes] = useState(asset?.notes ?? '');
  const [status, setStatus] = useState<AssetStatus>(asset?.status ?? 'active');
  const [date, setDate] = useState(() => (asset ? new Date(asset.acquisitionDate) : new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Five fields decide what an asset is worth; the other four are
  // record-keeping. Opening with nine inputs is how a two-minute task starts
  // looking like paperwork to an owner who types with one thumb. An asset
  // being edited opens expanded, because the detail is why they came back.
  const [showDetails, setShowDetails] = useState(() => Boolean(
    asset && (asset.serialNumber || asset.notes || asset.status !== 'active'),
  ));

  const parsedAcquisition = parseFloat(acquisitionValue);
  const acquisitionValid = !isNaN(parsedAcquisition) && parsedAcquisition >= 0;
  const acquisitionError =
    acquisitionValue.trim() !== '' && !acquisitionValid ? 'Enter a number' : undefined;

  const parsedCurrent = currentValue.trim() === '' ? null : parseFloat(currentValue);
  const currentValid = parsedCurrent === null || (!isNaN(parsedCurrent) && parsedCurrent >= 0);
  const currentError = !currentValid ? 'Enter a number, or leave blank' : undefined;

  const parsedQuantity = parseInt(quantity, 10);
  const quantityValid = !isNaN(parsedQuantity) && parsedQuantity >= 1;

  const nameValid = name.trim().length > 0;
  const canSave = nameValid && acquisitionValid && currentValid && quantityValid;

  const handleSave = () => {
    if (!canSave) {
      toast({
        type: 'error',
        message: !nameValid ? 'Give the asset a name' : 'Check the values you entered',
      });
      return;
    }
    onSave({
      name: name.trim(),
      category,
      acquisitionValue: parsedAcquisition,
      // null, not undefined: clearing the field has to actually clear the
      // stored estimate, and an omitted key would leave the old one in place.
      currentValue: parsedCurrent,
      quantity: parsedQuantity,
      acquisitionDate: date.toISOString(),
      serialNumber: serialNumber.trim(),
      notes: notes.trim(),
      status,
    });
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={s.title} accessibilityRole="header">{asset ? 'Edit asset' : 'Add asset'}</Text>

      <Input
        label="What is it?"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Display fridge"
        autoCapitalize="sentences"
      />

      <Text style={s.sectionLabel}>Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
        {CATEGORIES.map((value) => {
          const active = category === value;
          return (
            <AnimatedPressable
              key={value}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setCategory(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={ASSET_CATEGORY_LABELS[value]}
            >
              <Ionicons
                name={CATEGORY_ICONS[value]}
                size={16}
                color={active ? Colors.white : Colors.textSecondary}
              />
              <Text style={[s.chipText, active && s.chipTextActive]}>{ASSET_CATEGORY_LABELS[value]}</Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      <Input
        label="What you paid (per item)"
        value={acquisitionValue}
        onChangeText={setAcquisitionValue}
        keyboardType="numeric"
        placeholder="0"
        error={acquisitionError}
      />

      <Input
        label="Worth now (per item, optional)"
        value={currentValue}
        onChangeText={setCurrentValue}
        keyboardType="numeric"
        placeholder="Leave blank if you're not sure"
        hint="Leave blank and we count it at what you paid."
        error={currentError}
      />

      <Input
        label="How many"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="number-pad"
        placeholder="1"
      />

      <AnimatedPressable
        onPress={() => { haptics.light(); setShowDetails((v) => !v); }}
        style={s.detailsToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: showDetails }}
        accessibilityLabel={showDetails ? 'Hide extra details' : 'Add more details'}
      >
        <Text style={s.detailsToggleText}>{showDetails ? 'Hide extra details' : 'Add more details'}</Text>
        <Ionicons
          name={showDetails ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.primary}
        />
      </AnimatedPressable>

      {showDetails && (
      <>
      <Text style={s.sectionLabel}>Condition</Text>
      <View style={s.statusRow}>
        {STATUSES.map((value) => {
          const active = status === value;
          return (
            <AnimatedPressable
              key={value}
              style={[s.statusChip, active && s.chipActive]}
              onPress={() => setStatus(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={ASSET_STATUS_LABELS[value]}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{ASSET_STATUS_LABELS[value]}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
      {status === 'disposed' && (
        <Text style={s.statusNote}>Sold or scrapped items stop counting towards your capital.</Text>
      )}

      <Text style={s.sectionLabel}>When you got it</Text>
      <AnimatedPressable
        style={s.dateRow}
        onPress={() => setShowDatePicker(true)}
        accessibilityRole="button"
        accessibilityLabel={`Acquired ${formatDate(date)}. Change.`}
      >
        <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
        <Text style={s.dateText}>{formatDate(date)}</Text>
      </AnimatedPressable>
      {showDatePicker && (
        <DatePicker value={date} onChange={(d) => { setShowDatePicker(false); if (d) setDate(d); }} />
      )}

      <Input
        label="Serial number (optional)"
        value={serialNumber}
        onChangeText={setSerialNumber}
        autoCapitalize="characters"
        placeholder="For insurance or warranty"
      />
      <Input
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything worth remembering"
        multiline
      />
      </>
      )}

      <View style={s.buttonRow}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={s.flexBtn} />
        <Button
          title={asset ? 'Save changes' : 'Add asset'}
          onPress={handleSave}
          loading={loading}
          disabled={!canSave}
          style={s.flexBtn}
        />
      </View>

      {asset && onArchiveToggle && (
        <Button
          title={asset.archivedAt ? 'Restore to my assets' : 'Remove from my assets'}
          variant={asset.archivedAt ? 'ghost' : 'danger'}
          onPress={onArchiveToggle}
          style={s.archiveBtn}
        />
      )}
      {asset && !asset.archivedAt && (
        <Text style={s.archiveNote}>
          Removing hides it and takes it out of your capital. The record is kept, and you can restore it.
        </Text>
      )}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    letterSpacing: -0.4,
  },
  sectionLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  chipScroll: { marginBottom: Spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    // Material's 48dp floor — see PRODUCT.md on reduced dexterity.
    minHeight: 48,
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  chipTextActive: { color: Colors.white },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  statusChip: {
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  statusNote: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 17,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.md,
  },
  dateText: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    marginBottom: Spacing.sm,
  },
  detailsToggleText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  buttonRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
  archiveBtn: { marginTop: Spacing.sm },
  archiveNote: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 17,
    textAlign: 'center',
  },
});
