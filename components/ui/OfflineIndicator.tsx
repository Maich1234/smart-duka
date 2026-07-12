import React, { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
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
import { onQueueCountChange, onSyncStateChange, getPendingCount } from '@/utils/offlineQueue';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

// ─── Colour tokens ─────────────────────────────────────────────────────────────

const OFFLINE_BG   = '#F97316'; // warm orange
const SYNCING_BG   = '#0F766E'; // teal
const DONE_BG      = '#15803D'; // green — brief "all synced" flash
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
  }, []);

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

type ToastPhase = 'offline' | 'syncing' | 'done' | 'hidden';

// ─── Main component ────────────────────────────────────────────────────────────

export const OfflineIndicator: React.FC = () => {
  const [online, setOnline]           = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing]         = useState(false);
  const [phase, setPhase]             = useState<ToastPhase>('hidden');

  const insets = useSafeAreaInsets();

  // Refs used to drive auto-dismiss timers without stale closures
  const dismissTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPendingRef   = useRef<number>(0);

  const clearDismiss = () => {
    if (dismissTimerRef.current) { clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null; }
  };
  const clearDone = () => {
    if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null; }
  };

  // Subscribe to reactive data sources
  useEffect(() => {
    const initial = getPendingCount();
    setPendingCount(initial);
    // Seed the ref so the "queue just drained" logic works on the very first sync
    prevPendingRef.current = initial;

    // Only an explicit false means offline — null is "no reading yet" and
    // must not flash the offline banner (matches api.ts/offlineManager policy).
    const unsubNet   = NetInfo.addEventListener(s => setOnline(s.isConnected !== false));
    const unsubCount = onQueueCountChange(count => {
      setPendingCount(count);
      prevPendingRef.current = count;
    });
    const unsubSync  = onSyncStateChange(setSyncing);

    NetInfo.fetch().then(s => setOnline(s.isConnected !== false));

    return () => { unsubNet(); unsubCount(); unsubSync(); };
  }, []);

  // Drive the phase state machine
  useEffect(() => {
    clearDismiss();
    clearDone();

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
  }, [online, syncing, pendingCount]);

  // Cleanup on unmount
  useEffect(() => () => { clearDismiss(); clearDone(); }, []);

  if (phase === 'hidden') return null;

  const bg = phase === 'offline' ? OFFLINE_BG : phase === 'done' ? DONE_BG : SYNCING_BG;

  const label =
    phase === 'offline'
      ? `No internet${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`
      : phase === 'done'
        ? 'All synced'
        : `Syncing${pendingCount > 0 ? ` ${pendingCount} item${pendingCount > 1 ? 's' : ''}` : ''}…`;

  const iconName: keyof typeof Ionicons.glyphMap =
    phase === 'offline' ? 'cloud-offline-outline' : phase === 'done' ? 'checkmark-circle-outline' : 'sync-outline';

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18).stiffness(200)}
      exiting={SlideOutUp.duration(220)}
      style={[styles.wrapper, { top: insets.top + 10 }]}
      pointerEvents="box-none"
    >
      <View style={[styles.pill, { backgroundColor: bg }]}>
        {phase === 'syncing' ? (
          <PulsingDot />
        ) : (
          <Ionicons name={iconName} size={14} color={PILL_TEXT} style={styles.icon} />
        )}
        <Text style={styles.label} numberOfLines={1}>{label}</Text>

        {/* Close button — lets user dismiss the toast early */}
        {phase !== 'done' && (
          <AnimatedPressable
            onPress={() => setPhase('hidden')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.close}
          >
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.75)" />
          </AnimatedPressable>
        )}
      </View>
    </Animated.View>
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
