import React, { useState } from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { BottomSheet, SheetScrollBody, SheetFooter } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { haptics } from '@/utils/haptics';
import { formatDate } from '@/utils/formatters';
import type { BusinessPeriod, PeriodParams } from '@/services/business';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

// ── Chips ───────────────────────────────────────────────────────────────────

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  /**
   * Fire `onChange` even when this chip is already selected. Only "Custom"
   * needs it: the chip is a door to a date picker, and a selected door the
   * owner cannot reopen is a dead end — they could set a range once and never
   * change it.
   */
  repressable?: boolean;
}

interface ChipRowProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/**
 * A scrolling row of chips instead of a segmented control or a dropdown.
 *
 * Six product sorts do not fit a segmented control at 360dp, and a dropdown
 * hides the options behind a tap — on a screen whose whole job is answering
 * "compared to what?", the available comparisons should be visible.
 */
export function ChipRow<T extends string>({ options, value, onChange, accessibilityLabel }: ChipRowProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chipRow}
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <AnimatedPressable
            key={opt.value}
            onPress={() => {
              if (active && !opt.repressable) return;
              haptics.light();
              onChange(opt.value);
            }}
            style={[s.chip, active && s.chipActive]}
            // "button" + selected state, not "radio": RNGH-backed pressables
            // never fire under input-like roles on web.
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
          >
            <Text style={[s.chipLabel, active && s.chipLabelActive]}>{opt.label}</Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

// ── Period filter ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS: ChipOption<BusinessPeriod>[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Pick dates', repressable: true },
];

/**
 * YYYY-MM-DD from the calendar day the owner actually tapped.
 *
 * NOT `toISOString().slice(0, 10)`: the picker returns local midnight, and in
 * Nairobi (UTC+3) that is 21:00 the previous day in UTC — so tapping 1 Sep
 * would send "2026-08-31" and silently report the wrong month.
 */
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface PeriodFilterProps {
  value: PeriodParams;
  onChange: (value: PeriodParams) => void;
}

export const PeriodFilter: React.FC<PeriodFilterProps> = ({ value, onChange }) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(() => new Date());
  const [draftEnd, setDraftEnd] = useState(() => new Date());
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);

  const handleChange = (period: BusinessPeriod) => {
    if (period === 'custom') {
      setDraftStart(value.startDate ? new Date(value.startDate) : new Date());
      setDraftEnd(value.endDate ? new Date(value.endDate) : new Date());
      setEditing(null);
      setSheetOpen(true);
      return;
    }
    onChange({ period });
  };

  const applyCustom = () => {
    // Swapped rather than rejected: the owner's intent is unambiguous, and the
    // server would only answer with a 400 they cannot act on.
    const [from, to] = draftStart <= draftEnd ? [draftStart, draftEnd] : [draftEnd, draftStart];
    onChange({ period: 'custom', startDate: toISODate(from), endDate: toISODate(to) });
    setSheetOpen(false);
  };

  const options = PERIOD_OPTIONS.map((opt) =>
    opt.value === 'custom' && value.period === 'custom' && value.startDate && value.endDate
      ? { ...opt, label: `${formatDate(value.startDate)} – ${formatDate(value.endDate)}` }
      : opt,
  );

  return (
    <>
      <ChipRow
        options={options}
        value={value.period}
        onChange={handleChange}
        accessibilityLabel="Reporting period"
      />

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        maxHeightPercent={80}
        // The inline date picker is tall on both platforms; Apply has to stay
        // on screen while it is open.
        footer={(
          <SheetFooter>
            <Button title="Show these dates" onPress={applyCustom} />
          </SheetFooter>
        )}
      >
        <SheetScrollBody>
        <Text style={s.sheetTitle} accessibilityRole="header">Pick dates</Text>

        <DateField
          label="From"
          date={draftStart}
          active={editing === 'start'}
          onPress={() => setEditing(editing === 'start' ? null : 'start')}
        />
        {editing === 'start' && (
          <DatePicker value={draftStart} onChange={(d) => { if (d) setDraftStart(d); setEditing(null); }} />
        )}

        <DateField
          label="To"
          date={draftEnd}
          active={editing === 'end'}
          onPress={() => setEditing(editing === 'end' ? null : 'end')}
        />
        {editing === 'end' && (
          <DatePicker value={draftEnd} onChange={(d) => { if (d) setDraftEnd(d); setEditing(null); }} />
        )}

        </SheetScrollBody>
      </BottomSheet>
    </>
  );
};

const DateField: React.FC<{ label: string; date: Date; active: boolean; onPress: () => void }> = ({
  label, date, active, onPress,
}) => (
  <AnimatedPressable
    onPress={() => { haptics.light(); onPress(); }}
    style={[s.dateField, active && s.dateFieldActive]}
    accessibilityRole="button"
    accessibilityLabel={`${label}: ${formatDate(date)}. Change.`}
  >
    <Text style={s.dateLabel}>{label}</Text>
    <Text style={s.dateValue}>{formatDate(date)}</Text>
    <Ionicons name="calendar-outline" size={17} color={Colors.textSecondary} />
  </AnimatedPressable>
);

const s = StyleSheet.create({
  chipRow: { gap: Spacing.sm, paddingRight: Spacing.lg },
  chip: {
    paddingHorizontal: 16,
    // Material's 48dp floor, and PRODUCT.md's commitment to owners with
    // reduced dexterity — not a value picked to look right.
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipLabel: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  chipLabelActive: { color: Colors.white },

  sheetTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    letterSpacing: -0.4,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  dateFieldActive: { borderColor: Colors.primary, borderWidth: 2 },
  dateLabel: {
    width: 46,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  dateValue: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
});
