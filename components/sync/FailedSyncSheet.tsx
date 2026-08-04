import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  listFailedOperations,
  retryAllFailed,
  discardAllFailed,
  type FailedOperation,
} from '@/utils/offlineQueue';
import { useAlert } from '@/context/AlertContext';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface FailedSyncSheetProps {
  visible: boolean;
  onClose: () => void;
}

const timeAgo = (ts: number): string => {
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/**
 * Plain-language reason a row was refused.
 *
 * The server's own message is best when it sent one — it knows whether the
 * stock ran out or the receipt was already used. The status-code fallbacks
 * exist because a bare "400" tells a cashier nothing they can act on.
 */
const reasonFor = (op: FailedOperation): string => {
  if (op.error) return op.error;
  switch (op.status) {
    case 401:
    case 403:
      return 'You no longer have permission to make this change.';
    case 404:
      return 'The item this refers to no longer exists.';
    case 409:
      return 'This conflicts with something that changed while you were offline.';
    case 422:
    case 400:
      return 'The server would not accept these details.';
    default:
      return 'The server refused this change.';
  }
};

/**
 * The recovery surface for writes the server refused.
 *
 * Replaces a red pill that could only say "N changes failed to sync" and
 * offered retry/discard behind a nested dialog. Two things made that a dead
 * end: it never named what was lost, so discarding meant destroying unknown
 * work — a cashier will not press that, and shouldn't — and both actions were
 * broken anyway (retry replayed a burned idempotency key, discard's
 * confirmation could not render). Fixing the actions without showing what
 * they act on would still leave the user guessing whether the thing they are
 * about to delete was a KSh 20 sale or the morning's takings.
 */
export const FailedSyncSheet: React.FC<FailedSyncSheetProps> = ({ visible, onClose }) => {
  // Read once per open. The list is a snapshot of a decision point, and rows
  // shifting under the user's finger between reading and tapping is exactly
  // how someone discards the wrong thing.
  const [ops, setOps] = useState<FailedOperation[]>([]);
  const [loadedWhileVisible, setLoadedWhileVisible] = useState(false);
  // Which discard is awaiting confirmation: every row, or one row's id.
  //
  // Confirmed inside this sheet rather than through the global alert, which
  // would put a Modal on top of a Modal — a stack React Native does not
  // present reliably on iOS, and the one place in the app where a dialog
  // failing to appear silently destroys a cashier's takings. Keeping it
  // in-sheet also keeps the thing being discarded visible behind the prompt.
  const [confirming, setConfirming] = useState<'all' | string | null>(null);
  const { toast } = useAlert();

  // React's "adjust state when a prop changes" pattern: re-read the queue on
  // each open, and only then.
  if (visible !== loadedWhileVisible) {
    setLoadedWhileVisible(visible);
    if (visible) {
      setOps(listFailedOperations());
      setConfirming(null);
    }
  }

  const close = () => {
    setConfirming(null);
    onClose();
  };

  const handleRetryAll = () => {
    haptics.medium();
    const n = retryAllFailed(ops.map((o) => o.id));
    toast({
      type: 'info',
      message: n > 0 ? `Retrying ${n} change${n === 1 ? '' : 's'}…` : 'Nothing left to retry.',
    });
    close();
  };

  const confirmDiscard = () => {
    haptics.warning();
    // By id, not by status: a row the user retried a moment ago is 'pending'
    // again, and a status-only delete would skip it, report success, and let
    // it fail its way back onto the screen — which reads as the app ignoring
    // the user, and is exactly what testers reported.
    const targets = confirming === 'all' ? ops.map((o) => o.id) : [confirming as string];
    const n = discardAllFailed(targets);
    const remaining = ops.filter((o) => !targets.includes(o.id));
    setOps(remaining);
    setConfirming(null);
    toast({ type: 'warning', message: `Discarded ${n} change${n === 1 ? '' : 's'}.` });
    if (remaining.length === 0) close();
  };

  const pendingOp = confirming && confirming !== 'all'
    ? ops.find((o) => o.id === confirming)
    : null;

  if (confirming) {
    return (
      <BottomSheet visible={visible} onClose={close}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, styles.iconWrapDanger]}>
            <Ionicons name="trash-outline" size={24} color={Colors.danger} />
          </View>
          <Text style={styles.title}>
            {confirming === 'all'
              ? `Discard ${ops.length} change${ops.length === 1 ? '' : 's'}?`
              : `Discard this ${pendingOp?.label.toLowerCase() ?? 'change'}?`}
          </Text>
          <Text style={styles.subtitle}>
            {confirming === 'all'
              ? 'They will be permanently removed from this device and will never reach the server. This cannot be undone.'
              : 'It will be permanently removed from this device and will never reach the server. This cannot be undone.'}
          </Text>
        </View>
        <View style={styles.actions}>
          <Button
            title={confirming === 'all' ? 'Yes, discard them' : 'Yes, discard it'}
            onPress={confirmDiscard}
            variant="danger"
            size="lg"
            style={styles.action}
          />
          <Button title="Keep them" onPress={() => setConfirming(null)} variant="ghost" size="lg" />
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={close}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="alert-circle-outline" size={24} color={Colors.danger} />
        </View>
        <Text style={styles.title}>
          {ops.length} change{ops.length === 1 ? '' : 's'} couldn&apos;t sync
        </Text>
        <Text style={styles.subtitle}>
          These were sent to the server and turned down — usually because something changed while
          you were offline. Nothing here has been recorded. Retry if the cause is fixed, or discard
          to remove them for good.
        </Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {ops.map((op) => (
          <View key={op.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowLabel}>{op.label}</Text>
              <Text style={styles.rowReason}>{reasonFor(op)}</Text>
              <Text style={styles.rowMeta}>{timeAgo(op.createdAt)}</Text>
            </View>
            <AnimatedPressable
              onPress={() => setConfirming(op.id)}
              style={styles.rowDiscard}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Discard this ${op.label.toLowerCase()}`}
            >
              <Ionicons name="trash-outline" size={17} color={Colors.textTertiary} />
            </AnimatedPressable>
          </View>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Button title="Retry all" onPress={handleRetryAll} size="lg" style={styles.action} />
        <Button
          title="Discard all"
          onPress={() => setConfirming('all')}
          variant="ghost"
          size="lg"
          style={styles.action}
        />
        <Button title="Not now" onPress={close} variant="ghost" />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.dangerSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  iconWrapDanger: { backgroundColor: Colors.dangerSubtle },
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
    lineHeight: 20,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  list: { flexGrow: 0, maxHeight: 260 },
  listContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  rowMain: { flex: 1, gap: 2 },
  rowLabel: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  rowReason: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  rowMeta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },
  rowDiscard: { padding: 4 },
  actions: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.xs },
  action: { borderRadius: BorderRadius.lg },
});
