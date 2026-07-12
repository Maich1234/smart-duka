import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { StartShiftSheet } from './StartShiftSheet';
import { EndShiftSheet } from './EndShiftSheet';
import { useShift } from '@/hooks/useShift';
import { formatCurrency } from '@/utils/formatters';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const useShiftClock = (startedAt?: string) => {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!startedAt) return;
    const compute = () => {
      const mins = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
      setElapsed(mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`);
    };
    // First tick via macrotask (not synchronously in the effect body) so the
    // render that mounted the bar isn't immediately followed by a cascade.
    const kickoff = setTimeout(compute, 0);
    const id = setInterval(compute, 30_000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, [startedAt]);
  return startedAt ? elapsed : '';
};

/** Slim status strip shown above the till while a shift is running. */
export const ActiveShiftBar: React.FC = () => {
  const { enabled, shift } = useShift();
  const [ending, setEnding] = useState(false);
  const elapsed = useShiftClock(shift?.startedAt);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, []);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (!enabled || !shift) return null;

  return (
    <>
      <Animated.View entering={FadeInDown.duration(300)} style={styles.bar}>
        <Animated.View style={[styles.dot, dotStyle]} />
        <Text style={styles.barText}>
          On shift{elapsed ? ` · ${elapsed}` : ''} · float {formatCurrency(shift.openingFloat)}
        </Text>
        <AnimatedPressable
          onPress={() => {
            haptics.light();
            setEnding(true);
          }}
          style={styles.endBtn}
          accessibilityRole="button"
          accessibilityLabel="End shift"
        >
          <Text style={styles.endBtnText}>End shift</Text>
        </AnimatedPressable>
      </Animated.View>
      <EndShiftSheet visible={ending} shift={shift} onClose={() => setEnding(false)} />
    </>
  );
};

interface ShiftGateProps {
  children: React.ReactNode;
}

/**
 * Wraps the staff till: when the shop enforces shift management and no shift
 * is open, selling is locked behind a "start your shift" takeover. Everything
 * else renders the till as normal — including unknown states (first fetch
 * still in flight, endpoint unreachable). Never lock or blank on missing
 * data: a flaky connection kept re-triggering the old loading branch, tearing
 * down and remounting the entire till on every fetch cycle.
 */
export const ShiftGate: React.FC<ShiftGateProps> = ({ children }) => {
  const { enabled, shift } = useShift();
  const [starting, setStarting] = useState(false);

  if (!enabled || shift) return <>{children}</>;

  return (
    <View style={styles.gate}>
      <Animated.View entering={FadeInDown.duration(450)} style={styles.gateIcon}>
        <Ionicons name="storefront-outline" size={40} color={Colors.primary} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.duration(450).delay(80)} style={styles.gateTitle}>
        Ready to sell?
      </Animated.Text>
      <Animated.Text entering={FadeInDown.duration(450).delay(160)} style={styles.gateSub}>
        Start your shift to unlock the till. Count the drawer, clock in, and every sale you make
        will reconcile automatically when you clock out.
      </Animated.Text>
      <Animated.View entering={FadeInDown.duration(450).delay(240)} style={styles.gateCtaWrap}>
        <AnimatedPressable
          onPress={() => {
            haptics.medium();
            setStarting(true);
          }}
          style={styles.gateCta}
          accessibilityRole="button"
          accessibilityLabel="Start shift"
        >
          <Ionicons name="play" size={18} color="#FFFFFF" />
          <Text style={styles.gateCtaText}>Start Shift</Text>
        </AnimatedPressable>
      </Animated.View>

      <StartShiftSheet visible={starting} onClose={() => setStarting(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingVertical: 8,
    paddingLeft: Spacing.md,
    paddingRight: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  barText: {
    flex: 1,
    color: 'rgba(248,250,252,0.85)',
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    fontVariant: ['tabular-nums'],
  },
  endBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  endBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  gateIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  gateTitle: {
    fontSize: Typography.size.h1,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  gateSub: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.body,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  gateCtaWrap: { alignSelf: 'stretch' },
  gateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    ...Shadows.md,
  },
  gateCtaText: {
    color: '#FFFFFF',
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
