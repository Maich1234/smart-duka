import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Typography } from '@/constants/Typography';
import { Motion } from '@/constants/Motion';
import { Scene } from './theme';
import { useCountUp } from './useCountUp';

/** Scripted "day in the shop" — each tick lands one of these in the toast rail
 *  and moves the numbers, so the dashboard reads as genuinely alive. */
const EVENTS = [
  { icon: 'phone-portrait' as const, tint: '#34D399', title: 'M-PESA payment received', detail: '+KSh 250 · John K.', amount: 250, stock: 1 },
  { icon: 'cart' as const, tint: Scene.glowSoft, title: 'New sale · 3 items', detail: 'Sarah · Counter 1', amount: 480, stock: 3 },
  { icon: 'receipt' as const, tint: Scene.gold, title: 'Receipt #1042 printed', detail: 'Sent to customer', amount: 0, stock: 0 },
  { icon: 'cash' as const, tint: '#34D399', title: 'Cash sale recorded', detail: '+KSh 120 · Milk 500ml', amount: 120, stock: 1 },
  { icon: 'trending-up' as const, tint: Scene.glowSoft, title: 'Profit up 18% this week', detail: 'vs last week', amount: 0, stock: 0 },
  { icon: 'cube' as const, tint: Scene.gold, title: 'Stock updated automatically', detail: 'Sugar 1kg · 32 left', amount: 0, stock: 0 },
] as const;

const BAR_TARGETS = [0.38, 0.52, 0.44, 0.66, 0.58, 0.78, 0.9];
const BAR_MAX_H = 56;

const Bar: React.FC<{ target: number; index: number; bump: number }> = ({ target, index, bump }) => {
  const h = useSharedValue(0.06);

  // Staggered entrance on mount; after that, the most recent day's bar nudges
  // upward with every sale that lands.
  useEffect(() => {
    if (bump === 0) {
      h.value = withDelay(300 + index * 90, withSpring(target, { damping: 16, stiffness: 140 }));
    } else if (index === BAR_TARGETS.length - 1) {
      h.value = withSpring(Math.min(1, target + bump * 0.035), { damping: 13, stiffness: 180 });
    }
  }, [bump]);

  const style = useAnimatedStyle(() => ({ height: h.value * BAR_MAX_H }));
  const isToday = index === BAR_TARGETS.length - 1;

  return (
    <View style={styles.barSlot}>
      <Animated.View style={[styles.bar, isToday && styles.barToday, style]} />
    </View>
  );
};

const LiveDot: React.FC = () => {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[styles.liveDot, style]} />;
};

const FloatingChip: React.FC<{
  children: React.ReactNode;
  style?: object;
  dy?: number;
  duration?: number;
  delay?: number;
}> = ({ children, style, dy = 7, duration = 3600, delay = 0 }) => {
  const ty = useSharedValue(0);
  useEffect(() => {
    ty.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-dy, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(dy, { duration, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeInDown.duration(600).delay(700 + delay)}
      style={[styles.floatChip, style, animStyle]}
    >
      {children}
    </Animated.View>
  );
};

interface HeroDashboardProps {
  /** 'live' (preview mode) runs the event loop ~2.5× faster. */
  tempo?: 'ambient' | 'live';
}

/**
 * The welcome screen's product-in-action hero: a glass dashboard card where
 * sales land, revenue counts up, stock ticks down and the week's chart grows —
 * demonstrating outcomes before a single word of copy is read.
 */
export const HeroDashboard: React.FC<HeroDashboardProps> = ({ tempo = 'ambient' }) => {
  const [revenue, setRevenue] = useState(12450);
  const [stock, setStock] = useState(148);
  const [eventIndex, setEventIndex] = useState(0);
  const [salesLanded, setSalesLanded] = useState(0);
  const tickRef = useRef(0);

  const displayRevenue = useCountUp(revenue, 800);
  const displayStock = useCountUp(stock, 500);

  useEffect(() => {
    const interval = setInterval(
      () => {
        tickRef.current += 1;
        const next = EVENTS[tickRef.current % EVENTS.length];
        setEventIndex(tickRef.current % EVENTS.length);
        if (next.amount > 0) {
          setRevenue((r) => r + next.amount);
          setSalesLanded((n) => n + 1);
        }
        if (next.stock > 0) setStock((s) => Math.max(90, s - next.stock));
      },
      tempo === 'live' ? 1400 : 3400
    );
    return () => clearInterval(interval);
  }, [tempo]);

  const event = EVENTS[eventIndex];

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeInDown.duration(650).springify().damping(18)} style={styles.card}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Ionicons name="storefront" size={16} color={Scene.glowSoft} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.shopName}>Duka la Amani</Text>
            <Text style={styles.shopSub}>Nairobi · Open</Text>
          </View>
          <View style={styles.livePill}>
            <LiveDot />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Revenue */}
        <Text style={styles.revLabel}>Today&apos;s sales</Text>
        <Text style={styles.revValue}>
          KSh {Math.round(displayRevenue).toLocaleString('en-KE')}
        </Text>

        {/* Stat chips */}
        <View style={styles.statRow}>
          <View style={styles.statChip}>
            <Ionicons name="trending-up" size={12} color="#34D399" />
            <Text style={[styles.statText, { color: '#34D399' }]}>+18% profit</Text>
          </View>
          <View style={styles.statChip}>
            <Ionicons name="cube-outline" size={12} color={Scene.textDim} />
            <Text style={styles.statText}>{Math.round(displayStock)} items in stock</Text>
          </View>
        </View>

        {/* Week chart */}
        <View style={styles.chartRow}>
          {BAR_TARGETS.map((t, i) => (
            <Bar key={i} target={t} index={i} bump={salesLanded} />
          ))}
        </View>

        {/* Event rail */}
        <View style={styles.eventRail}>
          <Animated.View
            key={eventIndex}
            entering={FadeInDown.duration(Motion.duration.slow)}
            exiting={FadeOutUp.duration(Motion.duration.base)}
            style={styles.eventRow}
          >
            <View style={[styles.eventIcon, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
              <Ionicons name={event.icon} size={14} color={event.tint} />
            </View>
            <View style={styles.eventTextWrap}>
              <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.eventDetail} numberOfLines={1}>{event.detail}</Text>
            </View>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Floating satellites */}
      <FloatingChip style={styles.chipTopRight} dy={6} duration={3200}>
        <Ionicons name="add" size={12} color={Scene.gold} />
        <Text style={[styles.floatChipText, { color: Scene.gold }]}>KSh 1,200</Text>
      </FloatingChip>
      <FloatingChip style={styles.chipBottomLeft} dy={8} duration={4100} delay={400}>
        <Ionicons name="checkmark-circle" size={12} color="#34D399" />
        <Text style={[styles.floatChipText, { color: '#A7F3D0' }]}>Receipt sent</Text>
      </FloatingChip>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', width: '100%', maxWidth: 360 },
  card: {
    backgroundColor: Scene.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Scene.cardBorder,
    padding: 18,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(45,212,191,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  shopName: {
    color: Scene.text,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  shopSub: {
    color: Scene.textFaint,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(45,212,191,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Scene.glow },
  liveText: {
    color: Scene.glowSoft,
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 1,
  },
  revLabel: {
    color: Scene.textFaint,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    marginTop: 16,
  },
  revValue: {
    color: Scene.text,
    fontSize: 32,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: -0.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statText: {
    color: Scene.textDim,
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    fontVariant: ['tabular-nums'],
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: BAR_MAX_H,
    marginTop: 18,
  },
  barSlot: { flex: 1, height: BAR_MAX_H, justifyContent: 'flex-end' },
  bar: {
    borderRadius: 5,
    backgroundColor: 'rgba(94,234,212,0.28)',
  },
  barToday: { backgroundColor: Scene.glow },
  eventRail: { marginTop: 16, height: 44, justifyContent: 'center' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTextWrap: { flex: 1 },
  eventTitle: {
    color: Scene.text,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
  },
  eventDetail: {
    color: Scene.textFaint,
    fontSize: 11,
    fontFamily: Typography.fontFamily,
  },
  floatChip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(9,31,26,0.85)',
    borderWidth: 1,
    borderColor: Scene.cardBorderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipTopRight: { top: -14, right: 2 },
  chipBottomLeft: { bottom: -12, left: 2 },
  floatChipText: { fontSize: 11, fontFamily: Typography.fontFamilySemiBold },
});
