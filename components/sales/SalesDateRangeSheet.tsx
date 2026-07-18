import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { haptics } from '@/utils/haptics';
import { formatDate } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface SalesDateRangeSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Currently-applied range, if any. */
  startDate: Date | null;
  endDate: Date | null;
  /** Earliest selectable day — typically the shop's creation date. */
  minDate: Date;
  /** Latest selectable day — typically today; sales in the future can't exist. */
  maxDate: Date;
  onApply: (start: Date, end: Date) => void;
  onClear: () => void;
}

const toDateString = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fromDateString = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const clampToRange = (d: Date, min: Date, max: Date) => {
  if (d < min) return min;
  if (d > max) return max;
  return d;
};

/**
 * Custom-themed range calendar replacing the bare OS date picker on the sales
 * screen. Bounds selection to [minDate, maxDate] instead of leaving the whole
 * calendar open (which let people pick unfulfillable future dates or dates
 * before the shop existed).
 */
export const SalesDateRangeSheet: React.FC<SalesDateRangeSheetProps> = ({
  visible,
  onClose,
  startDate,
  endDate,
  minDate,
  maxDate,
  onApply,
  onClear,
}) => {
  const [pendingStart, setPendingStart] = useState<string | null>(
    startDate ? toDateString(startDate) : null
  );
  const [pendingEnd, setPendingEnd] = useState<string | null>(
    endDate ? toDateString(endDate) : null
  );

  // Reset draft selection to the applied range each time the sheet opens.
  React.useEffect(() => {
    if (visible) {
      setPendingStart(startDate ? toDateString(startDate) : null);
      setPendingEnd(endDate ? toDateString(endDate) : null);
    }
  }, [visible, startDate, endDate]);

  const minDateStr = toDateString(minDate);
  const maxDateStr = toDateString(maxDate);

  const handleDayPress = (day: DateData) => {
    haptics.selection();
    const tapped = day.dateString;
    if (!pendingStart || (pendingStart && pendingEnd)) {
      setPendingStart(tapped);
      setPendingEnd(null);
      return;
    }
    if (tapped < pendingStart) {
      setPendingEnd(pendingStart);
      setPendingStart(tapped);
    } else {
      setPendingEnd(tapped);
    }
  };

  const markedDates = useMemo(() => {
    if (!pendingStart) return {};
    const end = pendingEnd ?? pendingStart;
    const marks: Record<string, any> = {};
    let cursor = fromDateString(pendingStart);
    const endDateObj = fromDateString(end);
    while (cursor <= endDateObj) {
      const key = toDateString(cursor);
      marks[key] = {
        color: Colors.primary,
        textColor: Colors.white,
        startingDay: key === pendingStart,
        endingDay: key === end,
      };
      cursor = addDays(cursor, 1);
    }
    return marks;
  }, [pendingStart, pendingEnd]);

  const applyPreset = (start: Date, end: Date) => {
    haptics.light();
    const s = clampToRange(start, minDate, maxDate);
    const e = clampToRange(end, minDate, maxDate);
    setPendingStart(toDateString(s));
    setPendingEnd(toDateString(e));
  };

  const presets = [
    { label: 'Today', onPress: () => applyPreset(maxDate, maxDate) },
    { label: 'Last 7 days', onPress: () => applyPreset(addDays(maxDate, -6), maxDate) },
    { label: 'This month', onPress: () => applyPreset(startOfMonth(maxDate), maxDate) },
    { label: 'All time', onPress: () => applyPreset(minDate, maxDate) },
  ];

  const handleApply = () => {
    if (!pendingStart) return;
    haptics.light();
    onApply(fromDateString(pendingStart), fromDateString(pendingEnd ?? pendingStart));
    onClose();
  };

  const handleClear = () => {
    haptics.light();
    setPendingStart(null);
    setPendingEnd(null);
    onClear();
    onClose();
  };

  const rangeLabel = pendingStart
    ? `${formatDate(fromDateString(pendingStart))} – ${formatDate(fromDateString(pendingEnd ?? pendingStart))}`
    : 'Select a date range';

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightPercent={85}>
      <Text style={styles.title}>Filter by Date</Text>
      <Text style={styles.rangeLabel}>{rangeLabel}</Text>

      <View style={styles.presetsRow}>
        {presets.map((preset) => (
          <AnimatedPressable
            key={preset.label}
            style={styles.presetChip}
            onPress={preset.onPress}
            accessibilityRole="button"
            accessibilityLabel={preset.label}
          >
            <Text style={styles.presetChipText}>{preset.label}</Text>
          </AnimatedPressable>
        ))}
      </View>

      <Calendar
        current={pendingStart ?? maxDateStr}
        minDate={minDateStr}
        maxDate={maxDateStr}
        markingType="period"
        markedDates={markedDates}
        onDayPress={handleDayPress}
        enableSwipeMonths
        theme={{
          calendarBackground: Colors.surface,
          textSectionTitleColor: Colors.textTertiary,
          selectedDayBackgroundColor: Colors.primary,
          selectedDayTextColor: Colors.white,
          todayTextColor: Colors.primary,
          todayBackgroundColor: Colors.primarySubtle,
          dayTextColor: Colors.textPrimary,
          textDisabledColor: Colors.textDisabled,
          arrowColor: Colors.primary,
          monthTextColor: Colors.textPrimary,
          textDayFontFamily: Typography.fontFamily,
          textMonthFontFamily: Typography.fontFamilySemiBold,
          textDayHeaderFontFamily: Typography.fontFamilySemiBold,
          textDayFontSize: 14,
          textMonthFontSize: 15,
          textDayHeaderFontSize: 12,
        }}
        style={styles.calendar}
      />

      <View style={styles.footer}>
        <Button title="Clear" variant="outline" onPress={handleClear} style={styles.flexBtn} />
        <Button title="Apply" onPress={handleApply} disabled={!pendingStart} style={styles.flexBtn} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  rangeLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    justifyContent: 'center',
  },
  presetChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySubtle,
  },
  presetChipText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  calendar: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  flexBtn: {
    flex: 1,
  },
});
