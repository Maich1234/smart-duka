import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  SlideInUp,
  SlideOutUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  onQueueCountChange,
  onSyncStateChange,
  getPendingCount,
  getFailedCount,
} from '@/utils/offlineQueue';
import { FailedSyncSheet } from '@/components/sync/FailedSyncSheet';
import { Typography } from '@/constants/Typography';

// ─── Colour tokens ─────────────────────────────────────────────────────────────

const OFFLINE_BG   = '#F97316'; // warm orange
const SYNCING_BG   = '#0F766E'; // teal
const DONE_BG      = '#15803D'; // green — brief "all synced" flash
const FAILED_BG    = '#B91C1C'; // red — needs a decision from the user
const PILL_TEXT    = '#FFFFFF';

// ─── Pulsing dot for "syncing" state ──────────────────────────────────────────

const PulsingDot: React.FC = () => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    const pulse = () => {
      opacity.value = withSequence(
        withTiming(0.3, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,   { duration: 500, easing: Easing.inOut(Easing.ease) }),
      );
    };
    pulse();
    const id = setInterval(pulse, 1000);
    return () => clearInterval(id);
    // opacity is a Reanimated shared value — stable identity, declared for honesty.
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[dot.base, style]} />;
};

const dot = StyleSheet.create({
  base: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: PILL_TEXT,
    marginRight: 7,
  },
});

// ─── State machine ─────────────────────────────────────────────────────────────

type ToastPhase = 'offline' | 'syncing' | 'done' | 'failed' | 'hidden';

// ─── Main component ────────────────────────────────────────────────────────────

export const OfflineIndicator: React.FC = () => {
  const [online, setOnline]           = useState(true);
  // Seeded lazily so the subscribe effect below has nothing to set on mount.
  const [pendingCount, setPendingCount] = useState(() => getPendingCount());
  const [failedCount, setFailedCount]   = useState(() => getFailedCount());
  const [syncing, setSyncing]         = useState(false);
  const [phase, setPhase]             = useState<ToastPhase>('hidden');
  const [sheetOpen, setSheetOpen]     = useState(false);

  const insets = useSafeAreaInsets();

  // Refs used to drive auto-dismiss timers without stale closures
  const dismissTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPendingRef   = useRef<number>(getPendingCount());

  const clearDismiss = () => {
    if (dismissTimerRef.current) { clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null; }
  };
  const clearDone = () => {
    if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null; }
  };

  // Subscribe to reactive data sources
  useEffect(() => {
    // pendingCount and prevPendingRef are both seeded from getPendingCount()
    // at declaration, so there is nothing to set here — only subscriptions.

    // Only an explicit false means offline — null is "no reading yet" and
    // must not flash the offline banner (matches api.ts/offlineManager policy).
    const unsubNet   = NetInfo.addEventListener(s => setOnline(s.isConnected !== false));
    const unsubCount = onQueueCountChange((pending, failed) => {
      setPendingCount(pending);
      setFailedCount(failed);
      prevPendingRef.current = pending;
    });
    const unsubSync  = onSyncStateChange(setSyncing);

    NetInfo.fetch().then(s => setOnline(s.isConnected !== false));

    return () => { unsubNet(); unsubCount(); unsubSync(); };
  }, []);

  // Drive the phase state machine.
  //
  // set-state-in-effect is suppressed deliberately. This is a genuine external
  // state machine: it reacts to connectivity and queue events, and two of its
  // transitions are timed (offline auto-hides after 6s, "All synced" after 2s),
  // so the phase cannot be derived from the inputs alone. Rewriting it as
  // derived state needs an episode identity to tell one outage from the next,
  // which reintroduces exactly the bookkeeping this replaces. It runs only when
  // connectivity actually changes, not on every render.
  useEffect(() => {
    clearDismiss();
    clearDone();

    // Failures outrank every other state and never auto-dismiss: these are
    // writes the server refused, so they are lost unless the user acts. They
    // used to be marked failed and then never read by anything — the sale
    // simply disappeared with no feedback and no way back.
    if (failedCount > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('failed');
      return;
    }

    if (!online) {
      // Offline: show orange toast, auto-dismiss after 6 s
      setPhase('offline');
      dismissTimerRef.current = setTimeout(() => setPhase('hidden'), 6000);
      return;
    }

    if (syncing || pendingCount > 0) {
      // Online + syncing: show teal toast, no auto-dismiss (wait for queue drain)
      setPhase('syncing');
      return;
    }

    if (prevPendingRef.current > 0 && pendingCount === 0) {
      // Queue just drained: flash green "Synced" for 2 s then hide
      setPhase('done');
      doneTimerRef.current = setTimeout(() => setPhase('hidden'), 2000);
      return;
    }

    // All clear
    setPhase('hidden');
  }, [online, syncing, pendingCount, failedCount]);

  // Cleanup on unmount
  useEffect(() => () => { clearDismiss(); clearDone(); }, []);

  const pillVisible = phase !== 'hidden';

  const bg =
    phase === 'failed' ? FAILED_BG
      : phase === 'offline' ? OFFLINE_BG
        : phase === 'done' ? DONE_BG
          : SYNCING_BG;

  // "Needs review", not "failed": the pill is persistent and unmissable, and
  // the wording is what a cashier reads mid-transaction. Nothing is lost at
  // this point — the writes are still on the device and still recoverable —
  // so the label should prompt a look, not announce a disaster.
  const label =
    phase === 'failed'
      ? `${failedCount} change${failedCount > 1 ? 's' : ''} need${failedCount > 1 ? '' : 's'} review · Tap`
      : phase === 'offline'
        ? `No internet${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`
        : phase === 'done'
          ? 'All synced'
          : `Syncing${pendingCount > 0 ? ` ${pendingCount} item${pendingCount > 1 ? 's' : ''}` : ''}…`;

  const iconName: keyof typeof Ionicons.glyphMap =
    phase === 'failed' ? 'alert-circle-outline'
      : phase === 'offline' ? 'cloud-offline-outline'
        : phase === 'done' ? 'checkmark-circle-outline'
          : 'sync-outline';

  return (
    <>
    {/* The pill hides on its own schedule; the sheet must not. Discarding the
        last failed row flips the phase to 'hidden' in the same tick, and an
        early return up here would rip the sheet off the screen mid-read —
        including out from under the confirmation the user is answering. */}
    {pillVisible ? (
    <Animated.View
      entering={SlideInUp.springify().damping(18).stiffness(200)}
      exiting={SlideOutUp.duration(220)}
      style={[styles.wrapper, { top: insets.top + 10 }]}
      pointerEvents="box-none"
    >
      <AnimatedPressable
        style={[styles.pill, { backgroundColor: bg }]}
        // Only the failed pill is interactive — the others are pure status.
        onPress={phase === 'failed' ? () => setSheetOpen(true) : undefined}
        disabled={phase !== 'failed'}
        accessibilityRole={phase === 'failed' ? 'button' : 'text'}
        accessibilityLabel={label}
        accessibilityHint={phase === 'failed' ? 'Opens options to retry or discard the changes that failed to sync' : undefined}
      >
        {phase === 'syncing' ? (
          <PulsingDot />
        ) : (
          <Ionicons name={iconName} size={14} color={PILL_TEXT} style={styles.icon} />
        )}
        <Text style={styles.label} numberOfLines={1}>{label}</Text>

        {/* Close button — lets user dismiss the toast early. Withheld while
            changes have failed: dismissing would hide the only surface that
            can recover them, and the pill would not come back on its own. */}
        {phase !== 'done' && phase !== 'failed' && (
          <AnimatedPressable
            onPress={() => setPhase('hidden')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.75)" />
          </AnimatedPressable>
        )}
      </AnimatedPressable>
    </Animated.View>
    ) : null}

    <FailedSyncSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 14,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 40,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 14,
    // Max width so it reads like a toast, not a banner
    maxWidth: 320,
  },
  icon: {
    marginRight: 7,
  },
  label: {
    flex: 1,
    color: PILL_TEXT,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.2,
  },
  close: {
    marginLeft: 8,
    opacity: 0.85,
  },
});
