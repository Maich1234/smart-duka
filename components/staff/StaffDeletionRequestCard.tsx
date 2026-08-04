import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAlert } from '@/context/AlertContext';
import { approveStaffDeletion, declineStaffDeletion } from '@/services/staff';
import { formatDate } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface StaffDeletionRequestCardProps {
  staffId: string;
  staffName: string;
  requestedAt: string;
  /** Date the request goes ahead without an answer — see the backend's approval window. */
  autoApprovesAt?: string;
  /**
   * Cooling-off window approval starts, straight from the server. Only
   * defaulted so the card still renders if the meta hasn't loaded — never
   * hardcode it into copy, or it silently drifts from DELETION_GRACE_DAYS.
   */
  graceDays?: number;
  /** Called after approve/decline so the host screen can refetch or navigate away. */
  onResolved?: () => void;
}

/**
 * The owner's half of a staff account-closure request.
 *
 * A cashier's account carries the shop's sales and shift history, so the owner
 * decides — but only until the backend's approval window expires, at which
 * point an unanswered request proceeds on its own. That deadline is stated
 * plainly here rather than left as a surprise, because a request that lapses
 * looks identical to one the owner approved.
 *
 * Approving does not delete anything today: it starts the same cooling-off
 * window every closure gets, and the staff member can still call it off.
 */
export const StaffDeletionRequestCard: React.FC<StaffDeletionRequestCardProps> = ({
  staffId,
  staffName,
  requestedAt,
  autoApprovesAt,
  graceDays = 14,
  onResolved,
}) => {
  const queryClient = useQueryClient();
  const { alert, toast } = useAlert();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');

  // ['staff'] prefix-matches the detail query (['staff', id]) too, so this one
  // call covers the list, the badge and whichever profile is open.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['staffDeletionRequests'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approveStaffDeletion(staffId),
    onSuccess: (res) => {
      invalidate();
      toast({ type: 'success', message: res.message });
      onResolved?.();
    },
    onError: (error: any) =>
      toast({
        type: 'error',
        message: error?.response?.data?.message || 'Could not approve the request. Please try again.',
      }),
  });

  const declineMutation = useMutation({
    mutationFn: () => declineStaffDeletion(staffId, reason.trim() || undefined),
    onSuccess: (res) => {
      setDeclineOpen(false);
      setReason('');
      invalidate();
      toast({ type: 'success', message: res.message });
      onResolved?.();
    },
    onError: (error: any) =>
      toast({
        type: 'error',
        message: error?.response?.data?.message || 'Could not decline the request. Please try again.',
      }),
  });

  const busy = approveMutation.isPending || declineMutation.isPending;

  const handleApprove = () => {
    alert({
      type: 'confirm',
      title: `Approve ${staffName}'s closure?`,
      message: `Their account will close after a ${graceDays}-day cooling-off period. They keep working normally until then, and can still cancel. Your shop's sales and shift records are not affected.`,
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Approve', variant: 'danger', onPress: () => approveMutation.mutate() },
      ],
    });
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="person-remove-outline" size={16} color={Colors.warning} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Account closure request</Text>
            <Text style={styles.meta}>Asked on {formatDate(requestedAt)}</Text>
          </View>
        </View>

        <Text style={styles.body}>
          {staffName} has asked to close their Dukana account. Nothing has changed yet — approving
          starts a {graceDays}-day cooling-off period, and your shop&apos;s sales and shift records stay
          in the books either way.
        </Text>

        {autoApprovesAt && (
          <View style={styles.deadlineRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.deadlineText}>
              Goes ahead on its own if you don&apos;t answer by {formatDate(autoApprovesAt)}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Button
            title="Decline"
            variant="outline"
            onPress={() => setDeclineOpen(true)}
            disabled={busy}
            style={styles.actionBtn}
          />
          <Button
            title="Approve"
            variant="danger"
            onPress={handleApprove}
            loading={approveMutation.isPending}
            disabled={busy}
            style={styles.actionBtn}
          />
        </View>
      </View>

      <BottomSheet visible={declineOpen} onClose={() => !busy && setDeclineOpen(false)}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Decline this request?</Text>
          <Text style={styles.sheetBody}>
            {staffName}&apos;s account stays open and they&apos;ll be told you declined. They can ask
            again, so it&apos;s worth saying why.
          </Text>
          <Input
            label="Reason (optional)"
            placeholder="e.g. Finish this month's stock take first"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={300}
          />
          <Button
            title="Decline request"
            variant="danger"
            onPress={() => declineMutation.mutate()}
            loading={declineMutation.isPending}
            style={styles.sheetBtn}
          />
          <Button title="Cancel" variant="ghost" onPress={() => setDeclineOpen(false)} disabled={busy} />
        </View>
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.warningSubtle,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  title: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  body: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deadlineText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  actionBtn: { flex: 1 },

  sheet: { padding: Spacing.lg, gap: Spacing.sm },
  sheetTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  sheetBody: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  sheetBtn: { marginTop: Spacing.sm },
});
