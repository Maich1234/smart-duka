import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { QueryError } from '@/components/ui/QueryError';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { getShiftById, type ShiftSummary } from '@/services/shifts';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const Row: React.FC<{ label: string; value: string; strong?: boolean; tint?: string }> = ({
  label,
  value,
  strong,
  tint,
}) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, strong && styles.rowLabelStrong]}>{label}</Text>
    <Text style={[styles.rowValue, strong && styles.rowValueStrong, tint ? { color: tint } : null]}>
      {value}
    </Text>
  </View>
);

const Section: React.FC<{ title: string; delay?: number; children: React.ReactNode }> = ({
  title,
  delay = 0,
  children,
}) => (
  <Animated.View entering={FadeInUp.duration(380).delay(delay)} style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCard}>{children}</View>
  </Animated.View>
);

export default function ShiftReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['shift', id],
    queryFn: () => getShiftById(id!),
    enabled: !!id,
  });

  if (isLoading) return <ListSkeleton />;
  if (isError || !data?.data) return <QueryError onRetry={refetch} />;

  const shift = data.data;
  // Closed shifts show the frozen snapshot; active ones show live numbers.
  const summary: ShiftSummary | undefined = shift.summary?.salesCount !== undefined && shift.status === 'closed'
    ? shift.summary
    : (data.liveSummary ?? undefined);
  const name = typeof shift.staff === 'object' ? shift.staff.name : 'Staff';
  const discrepancy = summary?.cashDiscrepancy ?? null;

  const verdictTint =
    discrepancy === null ? Colors.textSecondary : discrepancy === 0 ? Colors.success : discrepancy > 0 ? Colors.info : Colors.danger;
  const verdictText =
    discrepancy === null
      ? shift.status === 'active'
        ? 'Shift in progress'
        : 'No cash count recorded'
      : discrepancy === 0
        ? 'Drawer balanced'
        : discrepancy > 0
          ? `Drawer over by ${formatCurrency(discrepancy)}`
          : `Drawer short by ${formatCurrency(Math.abs(discrepancy))}`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Verdict banner */}
      <Animated.View
        entering={FadeInUp.duration(380)}
        style={[styles.banner, { backgroundColor: `${verdictTint}14`, borderColor: `${verdictTint}33` }]}
      >
        <Ionicons
          name={discrepancy === null ? 'time-outline' : discrepancy === 0 ? 'checkmark-circle' : discrepancy > 0 ? 'trending-up' : 'alert-circle'}
          size={22}
          color={verdictTint}
        />
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, { color: verdictTint }]}>{verdictText}</Text>
          <Text style={styles.bannerSub}>
            {name} · {formatDateTime(shift.startedAt)}
            {shift.endedAt ? ` → ${formatDateTime(shift.endedAt)}` : ' (ongoing)'}
          </Text>
        </View>
      </Animated.View>

      {summary ? (
        <>
          <Section title="SALES" delay={60}>
            <Row label="Transactions" value={`${summary.salesCount}`} />
            <Row label="Gross sales" value={formatCurrency(summary.grossSales)} strong />
            {summary.discounts > 0 ? <Row label="Discounts given" value={`−${formatCurrency(summary.discounts)}`} /> : null}
          </Section>

          <Section title="PAYMENTS" delay={120}>
            <Row label={`Cash (${summary.byMethod.cash.count})`} value={formatCurrency(summary.byMethod.cash.total)} />
            <Row label={`M-PESA (${summary.byMethod.mpesa.count})`} value={formatCurrency(summary.byMethod.mpesa.total)} />
            <Row label={`Card (${summary.byMethod.card.count})`} value={formatCurrency(summary.byMethod.card.total)} />
          </Section>

          <Section title="ADJUSTMENTS" delay={180}>
            <Row label={`Refunds (${summary.refunds.count})`} value={`−${formatCurrency(summary.refunds.total)}`} tint={summary.refunds.count ? Colors.danger : undefined} />
            <Row label={`Voided sales (${summary.voids.count})`} value={formatCurrency(summary.voids.total)} />
            <Row label={`Cash expenses (${summary.cashExpenses.count})`} value={`−${formatCurrency(summary.cashExpenses.total)}`} />
            <Row label="Stock adjustments" value={`${summary.stockAdjustments}`} />
          </Section>

          <Section title="CASH RECONCILIATION" delay={240}>
            <Row label="Opening float" value={formatCurrency(shift.openingFloat)} />
            <Row label="Cash sales" value={`+${formatCurrency(summary.byMethod.cash.total)}`} />
            {summary.refunds.cashTotal > 0 ? <Row label="Cash refunds" value={`−${formatCurrency(summary.refunds.cashTotal)}`} /> : null}
            {summary.cashExpenses.total > 0 ? <Row label="Cash expenses" value={`−${formatCurrency(summary.cashExpenses.total)}`} /> : null}
            <View style={styles.rowDivider} />
            <Row label="Expected in drawer" value={formatCurrency(summary.expectedCash)} strong />
            {shift.closingCount !== undefined ? (
              <Row label="Counted at close" value={formatCurrency(shift.closingCount)} strong />
            ) : null}
            {discrepancy !== null ? (
              <Row
                label="Discrepancy"
                value={`${discrepancy > 0 ? '+' : ''}${formatCurrency(discrepancy)}`}
                strong
                tint={verdictTint}
              />
            ) : null}
          </Section>
        </>
      ) : null}

      <Section title="SESSION" delay={300}>
        <Row label="Staff" value={name} />
        {summary?.durationMinutes != null ? (
          <Row label="Duration" value={`${Math.floor(summary.durationMinutes / 60)}h ${summary.durationMinutes % 60}m`} />
        ) : null}
        {shift.device?.platform ? (
          <Row label="Device" value={[shift.device.name, shift.device.platform].filter(Boolean).join(' · ')} />
        ) : null}
        {shift.endedBy && typeof shift.endedBy === 'object' && typeof shift.staff === 'object' && shift.endedBy._id !== shift.staff._id ? (
          <Row label="Closed by" value={shift.endedBy.name} tint={Colors.warning} />
        ) : null}
        {shift.openingNote ? <Row label="Opening note" value={shift.openingNote} /> : null}
        {shift.closingNote ? <Row label="Closing note" value={shift.closingNote} /> : null}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bannerText: { flex: 1 },
  bannerTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
  },
  bannerSub: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  section: { marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    ...Shadows.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    gap: Spacing.md,
  },
  rowLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  rowLabelStrong: { fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  rowValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
  rowValueStrong: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilyBold },
  rowDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 4 },
});
