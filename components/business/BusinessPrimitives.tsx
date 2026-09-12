import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ProductHighlights } from '@/services/business';
import { formatQuantity } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/**
 * The small vocabulary the Business Overview is built from.
 *
 * Everything here is flat: a hairline border, one surface colour, no
 * gradients and no card shadows. The screen earns its hierarchy from type
 * size and spacing instead, because five tabs of stacked "premium" cards is
 * how a business overview turns back into the cluttered analytics dashboard
 * it was meant to replace.
 */

// ── Section heading ─────────────────────────────────────────────────────────

export const SectionTitle: React.FC<{ children: string; hint?: string }> = ({ children, hint }) => (
  <View style={s.sectionTitleWrap}>
    <Text style={s.sectionTitle} accessibilityRole="header">{children}</Text>
    {!!hint && <Text style={s.sectionHint}>{hint}</Text>}
  </View>
);

// ── Label / value row ───────────────────────────────────────────────────────

interface StatRowProps {
  label: string;
  /** null renders as "Not recorded" — never as zero. */
  value: string | null;
  sublabel?: string;
  emphasis?: boolean;
  tone?: 'default' | 'positive' | 'negative' | 'muted';
}

export const StatRow: React.FC<StatRowProps> = ({ label, value, sublabel, emphasis, tone = 'default' }) => (
  // One node, not three: TalkBack reading "Stock at cost" … "KES 10,100" as
  // separate stops makes a table of figures unusable to navigate.
  <View
    style={s.statRow}
    accessible
    accessibilityLabel={[label, value ?? 'Not recorded', sublabel].filter(Boolean).join('. ')}
  >
    <View style={s.statLabelWrap}>
      <Text style={[s.statLabel, emphasis && s.statLabelEmphasis]}>{label}</Text>
      {!!sublabel && <Text style={s.statSublabel}>{sublabel}</Text>}
    </View>
    <Text
      style={[
        s.statValue,
        emphasis && s.statValueEmphasis,
        value === null && s.statValueMissing,
        tone === 'positive' && s.positive,
        tone === 'negative' && s.negative,
        tone === 'muted' && s.statValueMissing,
      ]}
    >
      {value ?? 'Not recorded'}
    </Text>
  </View>
);

export const Divider: React.FC = () => <View style={s.divider} />;

/** Grouped rows on one surface — a list, not a card stack. */
export const Panel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={s.panel}>{children}</View>
);

// ── Ranked horizontal bars ──────────────────────────────────────────────────

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  /** Right-hand figure; defaults to the formatted value. */
  valueLabel: string;
  /** Second line under the label — share, units, availability. */
  caption?: string;
}

interface BarListProps {
  data: BarDatum[];
  emptyMessage: string;
  /** Rank numbers on the left — useful for leaderboards, noise elsewhere. */
  ranked?: boolean;
  tint?: string;
}

/**
 * Horizontal bars rather than a pie or donut: these answer "how do these
 * compare and by how much", which a length comparison shows and an angle
 * comparison does not.
 */
export const BarList: React.FC<BarListProps> = ({ data, emptyMessage, ranked = false, tint = Colors.primary }) => {
  if (data.length === 0) return <EmptyNote>{emptyMessage}</EmptyNote>;

  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <View style={s.barList}>
      {data.map((d, i) => (
        <View
          key={d.id}
          style={s.barRow}
          accessible
          accessibilityLabel={[
            ranked ? `${i + 1}.` : null, d.label, d.valueLabel, d.caption,
          ].filter(Boolean).join(' ')}
        >
          <View style={s.barHeader}>
            {ranked && <Text style={s.barRank}>{i + 1}</Text>}
            <View style={s.barLabelWrap}>
              <Text style={s.barLabel} numberOfLines={1}>{d.label}</Text>
              {!!d.caption && <Text style={s.barCaption} numberOfLines={1}>{d.caption}</Text>}
            </View>
            <Text style={s.barValue}>{d.valueLabel}</Text>
          </View>
          <View style={s.barTrack}>
            <View
              style={[
                s.barFill,
                {
                  // Always visible even at 0, so a row never looks like a
                  // rendering failure.
                  width: `${Math.max((Math.abs(d.value) / max) * 100, 2)}%`,
                  backgroundColor: d.value < 0 ? Colors.danger : tint,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

// ── Standouts ───────────────────────────────────────────────────────────────

export interface StandoutItem {
  key: string;
  /** What was measured — "Top seller", "Highest revenue". */
  label: string;
  /** The product that won it, or null when nothing sold. */
  name: string | null;
  /** The figure it won on. */
  value: string | null;
}

/**
 * Best-selling, highest-earning and most-profitable are three different
 * products more often than not: the cheap fast mover wins the first, the
 * expensive slow one often wins the third. They are shown as three labelled
 * answers rather than one "best product", because calling any of them best
 * answers a question the owner did not ask.
 *
 * The product name is the answer, so it gets the weight; the metric that
 * chose it is the caption.
 */
export const StandoutList: React.FC<{ items: StandoutItem[]; emptyMessage: string }> = ({
  items, emptyMessage,
}) => {
  if (items.every((i) => !i.name)) return <EmptyNote>{emptyMessage}</EmptyNote>;

  return (
    <Panel>
      {items.map((item, i) => (
        <View key={item.key}>
          {i > 0 && <Divider />}
          <View
            style={s.standout}
            accessible
            accessibilityLabel={`${item.label}: ${item.name ?? 'none'}, ${item.value ?? ''}`}
          >
            <View style={s.standoutText}>
              <Text style={s.standoutName} numberOfLines={1}>{item.name ?? '\u2014'}</Text>
              <Text style={s.standoutLabel}>{item.label}</Text>
            </View>
            <Text style={s.standoutValue}>{item.value ?? '\u2014'}</Text>
          </View>
        </View>
      ))}
    </Panel>
  );
};

/** The three rankings, in the wording both tabs show them in. */
export const productStandouts = (h: ProductHighlights, currency?: string): StandoutItem[] => [
  {
    key: 'units',
    label: 'Sold the most',
    name: h.topUnits?.name ?? null,
    value: h.topUnits ? `${formatQuantity(h.topUnits.units)} sold` : null,
  },
  {
    key: 'revenue',
    label: 'Brought in the most money',
    name: h.topRevenue?.name ?? null,
    value: h.topRevenue ? money(h.topRevenue.revenue, currency) : null,
  },
  {
    key: 'profit',
    label: 'Made the most profit',
    name: h.topProfit?.name ?? null,
    value: h.topProfit ? money(h.topProfit.grossProfit, currency) : null,
  },
];

// ── Notes ───────────────────────────────────────────────────────────────────

export const EmptyNote: React.FC<{ children: string }> = ({ children }) => (
  <Text style={s.emptyNote}>{children}</Text>
);

/** The honesty line that has to sit next to every estimated figure. */
export const InfoNote: React.FC<{ children: string; tone?: 'info' | 'warning' }> = ({ children, tone = 'info' }) => (
  <View style={[s.infoNote, tone === 'warning' && s.infoNoteWarning]}>
    <Ionicons
      name={tone === 'warning' ? 'alert-circle-outline' : 'information-circle-outline'}
      size={15}
      color={tone === 'warning' ? Colors.warningDark : Colors.textSecondary}
      style={s.infoIcon}
    />
    <Text style={[s.infoText, tone === 'warning' && s.infoTextWarning]}>{children}</Text>
  </View>
);

/** KES formatting without the trailing cents — every figure on this screen is a total. */
export const money = (amount: number, currency?: string) =>
  `${currency ?? 'KES'} ${Math.round(amount).toLocaleString()}`;

const s = StyleSheet.create({
  sectionTitleWrap: { marginBottom: Spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamilySemiBold,
    // textTertiary (#94A3B8) measures 2.56:1 on white — below the 4.5:1 floor,
    // and PRODUCT.md names visual impairment as a requirement, not a polish
    // item. Every grey that carries meaning on this screen is textSecondary.
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHint: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },

  panel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    minHeight: 48,
    paddingVertical: 10,
  },
  statLabelWrap: { flex: 1, gap: 2 },
  statLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  statLabelEmphasis: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  statSublabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  statValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  statValueEmphasis: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: -0.3,
  },
  statValueMissing: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
  },
  positive: { color: Colors.success },
  negative: { color: Colors.danger },
  divider: { height: 1, backgroundColor: Colors.divider },

  barList: { gap: 14 },
  barRow: { gap: 6 },
  barHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barRank: {
    width: 16,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  barLabelWrap: { flex: 1, gap: 1 },
  barLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  barCaption: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  barValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  standout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
    paddingVertical: 10,
  },
  standoutText: { flex: 1, gap: 1 },
  standoutName: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  standoutLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  standoutValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },

  emptyNote: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 20,
    paddingVertical: Spacing.md,
  },
  infoNote: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  infoNoteWarning: {
    backgroundColor: Colors.warningSubtle,
    borderColor: 'transparent',
  },
  infoIcon: { marginTop: 1 },
  infoText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  infoTextWarning: { color: Colors.warningDark },
});
