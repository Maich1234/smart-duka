import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { endShift, getShiftById, type Shift, type ShiftSummary } from '@/services/shifts';
import { useInvalidateShift } from '@/hooks/useShift';
import { useAlert } from '@/context/AlertContext';
import { formatCurrency } from '@/utils/formatters';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface EndShiftSheetProps {
  visible: boolean;
  shift: Shift | null;
  onClose: () => void;
  onEnded?: () => void;
}

const Row: React.FC<{ label: string; value: string; strong?: boolean; tint?: string }> = ({
  label,
  value,
  strong,
  tint,
}) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
    <Text style={[styles.rowValue, strong && styles.rowStrong, tint ? { color: tint } : null]}>
      {value}
    </Text>
  </View>
);

/**
 * Clock-out sheet in two acts: review the live reconciliation and enter the
 * counted drawer cash, then confirm to close and see the verdict (balanced /
 * over / short) with the full shift report.
 */
export const EndShiftSheet: React.FC<EndShiftSheetProps> = ({
  visible,
  shift,
  onClose,
  onEnded,
}) => {
  const [countedText, setCountedText] = useState('');
  const [closing, setClosing] = useState(false);
  const [closedShift, setClosedShift] = useState<Shift | null>(null);
  const { toast } = useAlert();
  const invalidateShift = useInvalidateShift();

  // Live preview of what the drawer *should* hold, before committing.
  const { data: detail, isLoading: loadingPreview } = useQuery({
    queryKey: ['shiftPreview', shift?._id],
    queryFn: () => getShiftById(shift!._id),
    enabled: visible && !!shift && !closedShift,
    refetchOnMount: 'always',
  });
  const live: ShiftSummary | null = detail?.liveSummary ?? null;

  const counted = useMemo(() => {
    const n = Number(countedText.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && countedText.trim() !== '' ? n : null;
  }, [countedText]);

  const previewDiscrepancy =
    counted !== null && live ? Math.round((counted - live.expectedCash) * 100) / 100 : null;

  const handleEnd = async () => {
    setClosing(true);
    try {
      const res = await endShift('current', {
        closingCount: counted ?? undefined,
      });
      const discrepancy = res.data.summary?.cashDiscrepancy ?? 0;
      if (discrepancy === 0 || discrepancy === null) haptics.success();
      else haptics.warning();
      setClosedShift(res.data);
      invalidateShift();
      onEnded?.();
    } catch (error: any) {
      haptics.error();
      toast({
        type: 'error',
        message: error.response?.data?.message || 'Could not close the shift. Try again.',
      });
    } finally {
      setClosing(false);
    }
  };

  const handleClose = () => {
    if (closing) return;
    setCountedText('');
    setClosedShift(null);
    onClose();
  };

  const summary = closedShift?.summary;
  const discrepancy = summary?.cashDiscrepancy ?? null;
  const verdict =
    discrepancy === null
      ? { icon: 'checkmark-circle' as const, tint: Colors.success, title: 'Shift closed' }
      : discrepancy === 0
        ? { icon: 'checkmark-circle' as const, tint: Colors.success, title: 'Drawer balanced 🎯' }
        : discrepancy > 0
          ? { icon: 'trending-up' as const, tint: Colors.info, title: `Drawer over by ${formatCurrency(discrepancy)}` }
          : { icon: 'alert-circle' as const, tint: Colors.danger, title: `Drawer short by ${formatCurrency(Math.abs(discrepancy))}` };

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!closedShift ? (
          <>
            <Text style={styles.title}>End your shift</Text>
            <Text style={styles.subtitle}>
              Here&apos;s everything from this session. Count the drawer to reconcile.
            </Text>

            {loadingPreview || !live ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.loadingText}>Reconciling your shift…</Text>
              </View>
            ) : (
              <View style={styles.card}>
                <Row label={`Sales (${live.salesCount})`} value={formatCurrency(live.grossSales)} strong />
                <Row label={`Cash (${live.byMethod.cash.count})`} value={formatCurrency(live.byMethod.cash.total)} />
                <Row label={`M-PESA (${live.byMethod.mpesa.count})`} value={formatCurrency(live.byMethod.mpesa.total)} />
                {live.byMethod.card.count > 0 ? (
                  <Row label={`Card (${live.byMethod.card.count})`} value={formatCurrency(live.byMethod.card.total)} />
                ) : null}
                {live.discounts > 0 ? <Row label="Discounts given" value={`−${formatCurrency(live.discounts)}`} /> : null}
                {live.refunds.count > 0 ? (
                  <Row label={`Refunds (${live.refunds.count})`} value={`−${formatCurrency(live.refunds.total)}`} tint={Colors.danger} />
                ) : null}
                {live.voids.count > 0 ? <Row label={`Voided sales (${live.voids.count})`} value={formatCurrency(live.voids.total)} /> : null}
                {live.cashExpenses.count > 0 ? (
                  <Row label={`Cash expenses (${live.cashExpenses.count})`} value={`−${formatCurrency(live.cashExpenses.total)}`} />
                ) : null}
                <View style={styles.divider} />
                <Row label="Opening float" value={formatCurrency(shift?.openingFloat ?? 0)} />
                <Row label="Expected cash in drawer" value={formatCurrency(live.expectedCash)} strong />
              </View>
            )}

            <Input
              label="Cash counted in drawer"
              placeholder="Count it now — every note and coin"
              value={countedText}
              onChangeText={setCountedText}
              keyboardType="numeric"
              leftIcon="cash-outline"
            />
            {previewDiscrepancy !== null ? (
              <Text
                style={[
                  styles.discrepancyHint,
                  {
                    color:
                      previewDiscrepancy === 0
                        ? Colors.success
                        : previewDiscrepancy > 0
                          ? Colors.info
                          : Colors.danger,
                  },
                ]}
              >
                {previewDiscrepancy === 0
                  ? '✓ Balanced to the shilling'
                  : previewDiscrepancy > 0
                    ? `${formatCurrency(previewDiscrepancy)} over expected`
                    : `${formatCurrency(Math.abs(previewDiscrepancy))} short of expected`}
              </Text>
            ) : null}

            <Button
              title="Close Shift"
              onPress={handleEnd}
              loading={closing}
              disabled={loadingPreview}
              size="lg"
              style={styles.endBtn}
            />
            <Button title="Not yet" onPress={handleClose} variant="ghost" />
          </>
        ) : (
          <View style={styles.doneWrap}>
            <Animated.View
              entering={ZoomIn.springify().damping(11)}
              style={[styles.verdictIcon, { backgroundColor: `${verdict.tint}1A` }]}
            >
              <Ionicons name={verdict.icon} size={40} color={verdict.tint} />
            </Animated.View>
            <Text style={styles.doneTitle}>{verdict.title}</Text>
            <Text style={styles.doneSub}>
              {summary?.salesCount ?? 0} sales · {formatCurrency(summary?.grossSales ?? 0)} ·{' '}
              {Math.floor((summary?.durationMinutes ?? 0) / 60)}h{' '}
              {(summary?.durationMinutes ?? 0) % 60}m on shift
            </Text>

            <Animated.View entering={FadeInUp.duration(400).delay(150)} style={[styles.card, styles.doneCard]}>
              <Row label="Cash sales" value={formatCurrency(summary?.byMethod.cash.total ?? 0)} />
              <Row label="M-PESA sales" value={formatCurrency(summary?.byMethod.mpesa.total ?? 0)} />
              <Row label="Expected cash" value={formatCurrency(summary?.expectedCash ?? 0)} />
              {closedShift.closingCount !== undefined ? (
                <Row label="Cash counted" value={formatCurrency(closedShift.closingCount)} strong />
              ) : null}
            </Animated.View>

            <Text style={styles.ownerNote}>
              <Ionicons name="notifications-outline" size={12} color={Colors.textTertiary} /> Your
              shift report was sent to the owner.
            </Text>

            <Button title="Done" onPress={handleClose} size="lg" style={styles.endBtn} />
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  title: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  loadingBox: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  loadingText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  rowValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  rowStrong: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 6 },
  discrepancyHint: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  endBtn: { borderRadius: BorderRadius.lg, marginTop: Spacing.xs },
  doneWrap: { alignItems: 'center' },
  verdictIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  doneTitle: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  doneSub: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  doneCard: { alignSelf: 'stretch' },
  ownerNote: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
});
