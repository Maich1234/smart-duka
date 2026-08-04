import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { QueryError } from '@/components/ui/QueryError';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { useAlert } from '@/context/AlertContext';
import {
  getBook,
  getBookCatalogue,
  downloadBook,
  type BookColumn,
  type BookFormat,
} from '@/services/books';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/**
 * Financial Records — the shop's books, readable on the phone and shareable
 * as PDF, Excel or CSV.
 *
 * Every figure comes from the server. A phone holding partially-synced data
 * must never produce its own version of a number that goes to a lender, which
 * is why nothing here is computed locally and why the screen shows a plain
 * "needs connection" state rather than falling back to cached figures.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);

const monthRange = (offset: number) => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  return { from: iso(from), to: iso(offset === 0 ? now : to) };
};

const PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  { label: 'This month', range: () => monthRange(0) },
  { label: 'Last month', range: () => monthRange(1) },
  {
    label: 'This year',
    range: () => ({ from: iso(new Date(new Date().getFullYear(), 0, 1)), to: iso(new Date()) }),
  },
];

/**
 * PDF first and on its own row: it is the format an accountant, a landlord or
 * a loan officer actually asks for, and it is the only one most phones can
 * open without another app installed. Excel and CSV are for the minority who
 * will work the numbers themselves.
 */
const PRIMARY_FORMAT: { value: BookFormat; label: string; icon: keyof typeof Ionicons.glyphMap } = {
  value: 'pdf',
  label: 'Download PDF',
  icon: 'document-text-outline',
};

const SECONDARY_FORMATS: { value: BookFormat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'xlsx', label: 'Excel', icon: 'grid-outline' },
  { value: 'csv', label: 'CSV', icon: 'list-outline' },
];

const formatCell = (value: string | number, column: BookColumn, currency: string): string => {
  if (value === '' || value === null || value === undefined) return '—';
  if (column.type === 'money') {
    return `${currency} ${Number(value).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (column.type === 'date') {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  }
  return String(value);
};

const humanise = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export default function BooksScreen() {
  const { toast } = useAlert();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [period, setPeriod] = useState(() => monthRange(0));
  const [downloading, setDownloading] = useState<BookFormat | null>(null);

  const catalogueQuery = useQuery({
    queryKey: ['bookCatalogue'],
    queryFn: getBookCatalogue,
  });

  const activeKey = selectedKey ?? catalogueQuery.data?.books[0]?.key ?? null;
  const activeBook = catalogueQuery.data?.books.find((b) => b.key === activeKey);

  const bookQuery = useQuery({
    queryKey: ['book', activeKey, period.from, period.to],
    queryFn: () => getBook(activeKey as string, period),
    enabled: !!activeKey,
    // Built fresh every time — a financial document served from a cache that
    // predates this morning's sales is worse than a spinner.
    staleTime: 0,
    retry: false,
  });

  const doc = bookQuery.data;
  const currency = doc?.shop.currency ?? catalogueQuery.data?.currency ?? 'KES';
  const isEmpty = useMemo(
    () => !!doc && doc.sections.every((s) => s.rows.length === 0),
    [doc]
  );

  const downloadDisabled = isEmpty || downloading !== null;

  const handleDownload = async (format: BookFormat) => {
    if (!doc || !activeKey) return;
    haptics.selection();
    setDownloading(format);
    try {
      await downloadBook(activeKey, doc.title, format, period, doc.period.label);
    } catch (error: any) {
      toast({ type: 'error', message: error?.message ?? 'Could not prepare that download.' });
    } finally {
      setDownloading(null);
    }
  };

  // The tab bar floats over this screen and the header above it already
  // carries the title, so the top inset belongs to neither.
  const screenProps = { edges: ['left', 'right'] as const, tabBarSpacing: true };

  if (catalogueQuery.isLoading) {
    return <Screen {...screenProps}><ListSkeleton rows={4} /></Screen>;
  }

  if (catalogueQuery.isError) {
    return (
      <Screen {...screenProps}>
        <QueryError
          message="Couldn't load your records. They're prepared on our servers, so this needs a connection."
          onRetry={() => catalogueQuery.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen {...screenProps}>
      <Text style={s.subtitle}>
        Your books, ready to share with your accountant or your bank.
      </Text>

      {/* Which book */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={s.chipRowContent}>
        {catalogueQuery.data?.books.map((entry) => {
          const active = entry.key === activeKey;
          return (
            <AnimatedPressable
              key={entry.key}
              onPress={() => { haptics.selection(); setSelectedKey(entry.key); }}
              style={[s.chip, active && s.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{entry.title}</Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {activeBook && <Text style={s.bookHint}>{activeBook.description}</Text>}

      {/* Which period */}
      <View style={s.periodRow}>
        {PRESETS.map((preset) => {
          const range = preset.range();
          const active = range.from === period.from && range.to === period.to;
          return (
            <AnimatedPressable
              key={preset.label}
              onPress={() => { haptics.selection(); setPeriod(range); }}
              style={[s.periodChip, active && s.periodChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.periodText, active && s.periodTextActive]}>{preset.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {bookQuery.isLoading ? (
        <ListSkeleton rows={5} />
      ) : bookQuery.isError || !doc ? (
        <QueryError
          message="Couldn't prepare that book. It's built on our servers, so this needs a connection."
          onRetry={() => bookQuery.refetch()}
        />
      ) : (
        <>
          <View style={s.card}>
            <Text style={s.bookTitle}>{doc.title}</Text>
            <Text style={s.bookPeriod}>{doc.period.label} · in {currency}</Text>

            {doc.meta.estimated && (
              <View style={s.warning}>
                <Ionicons name="warning-outline" size={16} color={Colors.warning} />
                <Text style={s.warningText}>
                  Some figures here are estimated — see the notes at the end.
                </Text>
              </View>
            )}

            {isEmpty ? (
              <Text style={s.empty}>Nothing recorded in this period.</Text>
            ) : (
              // Totals rather than every row: a phone is where you check a
              // figure, not where you read a 400-line register. The full
              // detail is in the file.
              <View style={s.totals}>
                {Object.entries(doc.totals).map(([key, value]) => {
                  const isCount = /^(sales|purchases|expenses)$/i.test(key);
                  return (
                    <View key={key} style={s.totalRow}>
                      <Text style={s.totalLabel}>{humanise(key)}</Text>
                      <Text style={s.totalValue}>
                        {isCount
                          ? value
                          : `${currency} ${Number(value).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* A short preview so the numbers above are traceable to something */}
          {!isEmpty && doc.sections[0]?.rows.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionHeading}>
                First {Math.min(5, doc.sections[0].rows.length)} of{' '}
                {doc.sections.reduce((n, sec) => n + sec.rows.length, 0)} entries
              </Text>
              {doc.sections[0].rows.slice(0, 5).map((row, i) => {
                const [first, ...rest] = doc.columns;
                const money = doc.columns.find((c) => c.type === 'money');
                return (
                  <View key={i} style={s.previewRow}>
                    <View style={s.previewMain}>
                      <Text style={s.previewPrimary} numberOfLines={1}>
                        {formatCell(row[rest[0]?.key ?? first.key], rest[0] ?? first, currency)}
                      </Text>
                      <Text style={s.previewSecondary}>
                        {formatCell(row[first.key], first, currency)}
                      </Text>
                    </View>
                    {money && (
                      <Text style={s.previewAmount}>
                        {formatCell(row[money.key], money, currency)}
                      </Text>
                    )}
                  </View>
                );
              })}
              <Text style={s.previewNote}>Download the file for the full record.</Text>
            </View>
          )}

          {doc.footnotes.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionHeading}>Notes</Text>
              {doc.footnotes.map((note, i) => (
                <Text key={i} style={s.footnote}>• {note}</Text>
              ))}
            </View>
          )}

          <View style={s.card}>
            <Text style={s.sectionHeading}>Download</Text>

            <AnimatedPressable
              onPress={() => handleDownload(PRIMARY_FORMAT.value)}
              disabled={downloadDisabled}
              style={[s.primaryBtn, downloadDisabled && s.btnDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: downloadDisabled, busy: downloading === PRIMARY_FORMAT.value }}
              accessibilityLabel="Download this book as a PDF"
            >
              {downloading === PRIMARY_FORMAT.value ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name={PRIMARY_FORMAT.icon} size={18} color={Colors.white} />
              )}
              <Text style={s.primaryBtnText}>
                {downloading === PRIMARY_FORMAT.value ? 'Preparing…' : PRIMARY_FORMAT.label}
              </Text>
            </AnimatedPressable>

            <View style={s.secondaryRow}>
              {SECONDARY_FORMATS.map(({ value, label, icon }) => (
                <AnimatedPressable
                  key={value}
                  onPress={() => handleDownload(value)}
                  disabled={downloadDisabled}
                  style={[s.secondaryBtn, downloadDisabled && s.btnDisabled]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: downloadDisabled, busy: downloading === value }}
                  accessibilityLabel={`Download this book as ${label}`}
                >
                  {downloading === value ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name={icon} size={17} color={Colors.primary} />
                  )}
                  <Text style={s.secondaryBtnText}>{label}</Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={s.shareHint}>
              {isEmpty
                ? 'Nothing to download for this period yet.'
                : 'Saves to your phone, or send straight to WhatsApp or email.'}
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  subtitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  chipRow: { marginHorizontal: -Spacing.lg },
  chipRowContent: { paddingHorizontal: Spacing.lg, gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primarySubtle, borderColor: Colors.primary },
  chipText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  chipTextActive: { color: Colors.primary },
  bookHint: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  periodRow: { flexDirection: 'row', gap: Spacing.xs, marginVertical: Spacing.md },
  periodChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  periodChipActive: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primary },
  periodText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  periodTextActive: { color: Colors.primary, fontFamily: Typography.fontFamilySemiBold },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bookTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  bookPeriod: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.warningSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  empty: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
  totals: { marginTop: Spacing.md, gap: Spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  totalValue: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  sectionHeading: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  previewMain: { flex: 1 },
  previewPrimary: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  previewSecondary: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  previewAmount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  previewNote: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  footnote: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    minHeight: 48,
  },
  primaryBtnText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.white,
  },
  secondaryRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    minHeight: 44,
  },
  secondaryBtnText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  btnDisabled: { opacity: 0.45 },
  shareHint: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
