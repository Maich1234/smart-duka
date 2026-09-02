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
  ZoomIn,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Typography } from '@/constants/Typography';
import { Scene } from './theme';
import { DEMO_PRODUCTS } from './content';
import { useCountUp } from './useCountUp';

type Phase = 'adding' | 'charging' | 'paid';

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
    // Reanimated shared values: stable identities, declared for honesty.
  }, [pulse]);
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
    // Shared values and per-instance constants — stable for this
    // element's lifetime, so declaring them keeps the animation mount-only.
  }, [delay, duration, dy, ty]);
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

const ProductTile: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  price: number;
  added: boolean;
}> = ({ icon, name, price, added }) => {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (added) {
      scale.value = withSequence(
        withTiming(1.06, { duration: 140 }),
        withSpring(1, { damping: 10, stiffness: 180 })
      );
    }
    // Reanimated shared values: stable identities, declared for honesty.
  }, [added, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.tile, added && styles.tileAdded, style]}>
      <View style={[styles.tileIconWrap, added && styles.tileIconWrapAdded]}>
        <Ionicons name={icon} size={15} color={added ? Scene.glowSoft : Scene.textDim} />
      </View>
      <View style={styles.tileTextWrap}>
        <Text style={styles.tileName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.tilePrice}>KSh {price}</Text>
      </View>
      {added ? (
        <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.tileCheck}>
          <Ionicons name="checkmark" size={10} color={Scene.bgFrom} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
};

interface HeroDashboardProps {
  /** 'live' (preview mode) runs the ring-up loop ~1.7× faster. */
  tempo?: 'ambient' | 'live';
}

/**
 * The welcome screen's product-in-action hero: a glass till where products
 * get "tapped" onto a running cart total, charged over M-PESA and marked
 * paid — the same rhythm as the interactive first-sale demo, so the promise
 * on screen one is the exact thing screen two lets you touch.
 */
export const HeroDashboard: React.FC<HeroDashboardProps> = ({ tempo = 'ambient' }) => {
  // Cycle position lives in a ref, not state — nothing ever renders it
  // directly, only the cart/total/phase it derives each tick.
  const stepRef = useRef(0);
  const [cart, setCart] = useState<number[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<Phase>('adding');

  const displayTotal = useCountUp(total, 500);
  const stepMs = tempo === 'live' ? 750 : 1300;
  const cycleLength = DEMO_PRODUCTS.length + 2; // one step per product, then charging, then paid

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (stepRef.current + 1) % cycleLength;
      stepRef.current = next;
      if (next < DEMO_PRODUCTS.length) {
        setPhase('adding');
        setCart((c) => [...c, next]);
        setTotal((t) => t + DEMO_PRODUCTS[next].price);
      } else if (next === DEMO_PRODUCTS.length) {
        setPhase('charging');
      } else {
        setPhase('paid');
      }
    }, stepMs);
    return () => clearInterval(interval);
  }, [stepMs, cycleLength]);

  // The beat after "paid" clears the till for the next lap of the loop.
  useEffect(() => {
    if (phase !== 'paid') return;
    const t = setTimeout(() => {
      setCart([]);
      setTotal(0);
    }, stepMs - 150);
    return () => clearTimeout(t);
  }, [phase, stepMs]);

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

        {/* Till grid */}
        <View style={styles.grid}>
          {DEMO_PRODUCTS.map((p, i) => (
            <ProductTile key={p.id} icon={p.icon} name={p.name} price={p.price} added={cart.includes(i)} />
          ))}
        </View>

        {/* Cart total + charge state */}
        <View style={styles.totalRow}>
          <View>
            <Text style={styles.totalLabel}>{phase === 'paid' ? 'Payment received' : 'Cart total'}</Text>
            <Text style={styles.totalValue}>
              KSh {Math.round(displayTotal).toLocaleString('en-KE')}
            </Text>
          </View>
          <View
            style={[
              styles.chargePill,
              phase === 'charging' && styles.chargePillCharging,
              phase === 'paid' && styles.chargePillPaid,
            ]}
          >
            <Ionicons
              name={phase === 'paid' ? 'checkmark' : 'phone-portrait-outline'}
              size={13}
              color={phase === 'adding' ? Scene.glowSoft : Scene.bgFrom}
            />
            <Text style={[styles.chargeText, phase !== 'adding' && styles.chargeTextActive]}>
              {phase === 'paid' ? 'Paid' : phase === 'charging' ? 'Charging…' : 'M-PESA'}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Floating satellites */}
      <FloatingChip style={styles.chipTopRight} dy={6} duration={3200}>
        <Ionicons name="receipt-outline" size={12} color={Scene.gold} />
        <Text style={[styles.floatChipText, { color: Scene.gold }]}>Receipt printed</Text>
      </FloatingChip>
      <FloatingChip style={styles.chipBottomLeft} dy={8} duration={4100} delay={400}>
        <Ionicons name="cube-outline" size={12} color="#A7F3D0" />
        <Text style={[styles.floatChipText, { color: '#A7F3D0' }]}>Stock updated</Text>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  tile: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: Scene.cardBorderSoft,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 9,
  },
  tileAdded: {
    borderColor: Scene.glow,
    backgroundColor: 'rgba(45,212,191,0.10)',
  },
  tileIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconWrapAdded: { backgroundColor: 'rgba(45,212,191,0.16)' },
  tileTextWrap: { flex: 1 },
  tileName: {
    color: Scene.text,
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
  },
  tilePrice: {
    color: Scene.textFaint,
    fontSize: 10,
    fontFamily: Typography.fontFamily,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  tileCheck: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Scene.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Scene.cardBorderSoft,
  },
  totalLabel: {
    color: Scene.textFaint,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
  },
  totalValue: {
    color: Scene.text,
    fontSize: 24,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: -0.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  chargePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(45,212,191,0.14)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chargePillCharging: { backgroundColor: Scene.glow },
  chargePillPaid: { backgroundColor: '#34D399' },
  chargeText: {
    color: Scene.glowSoft,
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
  },
  chargeTextActive: { color: Scene.bgFrom },
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
