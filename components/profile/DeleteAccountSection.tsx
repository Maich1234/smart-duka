import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAlert } from '@/context/AlertContext';
import { previewAccountDeletion, deleteAccount, cancelAccountDeletion } from '@/services/auth';
import { formatDate } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/**
 * In-app account closure.
 *
 * Google Play requires any app offering account creation to provide account
 * deletion inside the app *and* at a public web URL. Neither existed before
 * this, which is an automatic rejection at review.
 *
 * Closure is scheduled, not immediate: nothing is destroyed for 14 days, the
 * account keeps working normally, and one tap calls it off. Deleting an owner
 * account takes a whole business and every staff account with it — far too
 * much damage to allow from a mistaken tap, a borrowed unlocked phone, or an
 * argument. Play's requirement is satisfied by an initiated deletion with a
 * stated completion date; a recovery window is expressly permitted.
 *
 * Staff take one extra step: the request goes to the shop owner first
 * (`requiresOwnerApproval`), because a cashier's account carries the shop's
 * books rather than personal property. Three states, not two — nothing filed,
 * waiting on the owner, or approved and counting down.
 *
 * Getting *in* is deliberately effortful (password + typed DELETE); getting
 * back out is deliberately trivial, at every one of those states.
 */
export const DeleteAccountSection: React.FC = () => {
  const { toast } = useAlert();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');

  // Always enabled, not just while the sheet is open — the scheduled state
  // drives the banner below, which must show without opening anything.
  const { data: preview, isLoading } = useQuery({
    queryKey: ['accountDeletionPreview'],
    queryFn: previewAccountDeletion,
    retry: false,
  });

  const scheduledAt = preview?.deletionScheduledAt ?? null;
  const awaitingApproval = preview?.awaitingOwnerApproval ?? false;
  const requiresApproval = preview?.requiresOwnerApproval ?? false;

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount(password),
    onSuccess: (res) => {
      close();
      queryClient.invalidateQueries({ queryKey: ['accountDeletionPreview'] });
      toast({ type: 'success', message: res.message });
    },
    onError: (error: any) => {
      toast({
        type: 'error',
        message: error?.response?.data?.message || 'Could not schedule closure. Please try again.',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelAccountDeletion,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['accountDeletionPreview'] });
      toast({ type: 'success', message: res.message });
    },
    onError: (error: any) => {
      toast({
        type: 'error',
        message: error?.response?.data?.message || 'Could not cancel. Please try again.',
      });
    },
  });

  const close = () => {
    if (deleteMutation.isPending) return;
    setOpen(false);
    setPassword('');
    setConfirmText('');
  };

  const canSubmit = password.length > 0 && confirmText === 'DELETE' && !deleteMutation.isPending;

  // ── Scheduled: the only thing to offer is a way back ────────────────────
  if (scheduledAt) {
    return (
      <View style={styles.pendingCard}>
        <View style={styles.pendingHeader}>
          <Ionicons name="alert-circle" size={18} color={Colors.danger} />
          <Text style={styles.pendingTitle}>Account closing on {formatDate(scheduledAt)}</Text>
        </View>
        <Text style={styles.pendingBody}>
          Everything still works until then. Cancel any time before that date and nothing will be lost.
        </Text>
        <Button
          title="Keep my account"
          onPress={() => cancelMutation.mutate()}
          loading={cancelMutation.isPending}
          style={styles.keepBtn}
        />
      </View>
    );
  }

  // ── Filed, waiting on the owner ─────────────────────────────────────────
  // Deliberately not styled as danger: nothing has happened to the account,
  // and it may never — the owner can decline.
  if (awaitingApproval) {
    return (
      <View style={styles.awaitingCard}>
        <View style={styles.pendingHeader}>
          <Ionicons name="hourglass-outline" size={18} color={Colors.warning} />
          <Text style={styles.awaitingTitle}>Waiting for your shop owner</Text>
        </View>
        <Text style={styles.pendingBody}>
          You asked to close your account
          {preview?.deletionRequestedAt ? ` on ${formatDate(preview.deletionRequestedAt)}` : ''}. Your
          shop owner has to approve it first. Nothing changes until they do, and you can still use the
          app normally.
        </Text>
        <Button
          title="Withdraw my request"
          variant="outline"
          onPress={() => cancelMutation.mutate()}
          loading={cancelMutation.isPending}
          style={styles.keepBtn}
        />
      </View>
    );
  }

  return (
    <>
      <AnimatedPressable
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Delete my account"
      >
        <Ionicons name="trash-outline" size={17} color={Colors.danger} />
        <Text style={styles.triggerText}>Delete my account</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </AnimatedPressable>

      <BottomSheet visible={open} onClose={close}>
        <View style={styles.sheet}>
          <Text style={styles.title}>
            {requiresApproval ? 'Request account closure?' : 'Delete your account?'}
          </Text>

          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loading} />
          ) : (
            <>
              {requiresApproval ? (
                <Text style={styles.body}>
                  Your shop owner has to approve this first. Once they do, your account stays open for
                  another {preview?.graceDays ?? 14} days and you can still cancel. After that it&apos;s
                  permanent.
                </Text>
              ) : (
                <Text style={styles.body}>
                  Your account will stay open for {preview?.graceDays ?? 14} more days. Nothing is
                  deleted until then, and you can cancel any time. After that it&apos;s permanent.
                </Text>
              )}

              {requiresApproval && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
                  <Text style={styles.infoText}>
                    Your sales and shift records stay with the shop either way. They&apos;re the
                    owner&apos;s books, not part of your personal profile.
                  </Text>
                </View>
              )}

              {preview?.cascades && (
                <View style={styles.warnBox}>
                  <Ionicons name="warning-outline" size={18} color={Colors.danger} />
                  <Text style={styles.warnText}>
                    You own {preview.shopName ?? 'this shop'}. Closing your account also closes the shop
                    {preview.staffAccountsRemoved > 0
                      ? ` and removes ${preview.staffAccountsRemoved} staff account${preview.staffAccountsRemoved === 1 ? '' : 's'}`
                      : ''}
                    . Everyone loses access.
                  </Text>
                </View>
              )}

              <Text style={styles.footnote}>
                Your sales, purchases, expenses, and payment records are kept as bookkeeping records with
                your personal details removed, as described in our Privacy Policy.
              </Text>

              <Input
                label="Your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <Input
                label="Type DELETE to confirm"
                value={confirmText}
                onChangeText={(t) => setConfirmText(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <Button
                title={requiresApproval ? 'Request closure' : 'Schedule closure'}
                variant="danger"
                onPress={() => deleteMutation.mutate()}
                loading={deleteMutation.isPending}
                disabled={!canSubmit}
                style={styles.confirmBtn}
              />
              <Button title="Cancel" variant="ghost" onPress={close} />
            </>
          )}
        </View>
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  triggerText: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.danger,
  },
  pendingCard: {
    backgroundColor: Colors.dangerSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    margin: Spacing.md,
    gap: Spacing.xs,
  },
  awaitingCard: {
    backgroundColor: Colors.warningSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    margin: Spacing.md,
    gap: Spacing.xs,
  },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pendingTitle: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.danger,
  },
  awaitingTitle: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  pendingBody: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  keepBtn: { marginTop: Spacing.sm },
  sheet: { padding: Spacing.lg, gap: Spacing.sm },
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  body: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  loading: { paddingVertical: Spacing.xl },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.xs,
  },
  warnText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.danger,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.xs,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  footnote: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  confirmBtn: { marginTop: Spacing.sm },
});
