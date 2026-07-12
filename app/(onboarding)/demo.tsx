import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Confetti } from '@/components/onboarding/Confetti';
import { useCountUp } from '@/components/onboarding/useCountUp';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const PRODUCTS = [
  { id: 'milk', emoji: '🥛', name: 'Milk 500ml', price: 65 },
  { id: 'bread', emoji: '🍞', name: 'Bread', price: 60 },
  { id: 'sugar', emoji: '🍚', name: 'Sugar 1kg', price: 210 },
  { id: 'soap', emoji: '🧼', name: 'Soap', price: 120 },
] as const;

const INITIAL_STOCK = 36;

type Phase = 'pick' | 'stk' | 'paid' | 'receipt';

/** Gentle attention pulse on the "tap a product" hint until the first tap. */
const PulsingHint: React.FC<{ text: string }> = ({ text }) => {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.hint, style]} entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)}>
      <Ionicons name="hand-left-outline" size={14} color={Colors.primary} />
      <Text style={styles.hintText}>{text}</Text>
    </Animated.View>
  );
};

const StatTile: React.FC<{ label: string; value: string; accent?: boolean }> = ({
  label,
  value,
  accent,
}) => (
  <View style={styles.statTile}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, accent && { color: Colors.primary }]}>{value}</Text>
  </View>
);

export default function DemoSale() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isGuest = mode === 'guest';

  const [phase, setPhase] = useState<Phase>('pick');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [salesTotal, setSalesTotal] = useState(0);
  const [profit, setProfit] = useState(0);
  const [stock, setStock] = useState(INITIAL_STOCK);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const itemCount = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  const cartTotal = useMemo(
    () => PRODUCTS.reduce((sum, p) => sum + p.price * (cart[p.id] ?? 0), 0),
    [cart]
  );

  const displaySales = useCountUp(salesTotal, 900);
  const displayProfit = useCountUp(profit, 900);
  const displayStock = useCountUp(stock, 600);

  const addToCart = (id: string) => {
    if (phase !== 'pick') return;
    haptics.selection();
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  };

  const charge = () => {
    haptics.medium();
    setPhase('stk');
    timersRef.current.push(
      setTimeout(() => {
        haptics.success();
        setPhase('paid');
      }, 1500),
      setTimeout(() => {
        setPhase('receipt');
        setSalesTotal((s) => s + cartTotal);
        setProfit((p) => p + Math.round(cartTotal * 0.28));
        setStock((s) => s - itemCount);
      }, 2600)
    );
  };

  const reset = () => {
    haptics.light();
    setCart({});
    setPhase('pick');
  };

  const soldItems = PRODUCTS.filter((p) => (cart[p.id] ?? 0) > 0);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tryPill}>
          <Ionicons name="flash" size={12} color={Colors.accentDark} />
          <Text style={styles.tryPillText}>{isGuest ? 'DEMO MODE' : 'TRY IT'}</Text>
        </View>
        <AnimatedPressable
          onPress={() =>
            isGuest ? router.push('/(onboarding)/signup') : router.push('/(onboarding)/personalize')
          }
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
        >
          <Text style={styles.skip}>{isGuest ? 'Create my shop' : 'Skip'}</Text>
        </AnimatedPressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text entering={FadeInDown.duration(450)} style={styles.title}>
          Make your first sale.
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(450).delay(90)} style={styles.subtitle}>
          No account needed — this shop is yours to play with.
        </Animated.Text>

        {/* Live stats strip */}
        <Animated.View entering={FadeInDown.duration(450).delay(160)} style={styles.statsRow}>
          <StatTile label="Today" value={`KSh ${Math.round(displaySales).toLocaleString()}`} accent />
          <StatTile label="Profit" value={`KSh ${Math.round(displayProfit).toLocaleString()}`} />
          <StatTile label="In stock" value={`${Math.round(displayStock)}`} />
        </Animated.View>

        {/* Product grid */}
        <View style={styles.grid}>
          {PRODUCTS.map((p, i) => {
            const qty = cart[p.id] ?? 0;
            return (
              <Animated.View
                key={p.id}
                entering={FadeInUp.duration(400).delay(220 + i * 70)}
                style={styles.gridItem}
              >
                <AnimatedPressable
                  onPress={() => addToCart(p.id)}
                  pressScale={0.95}
                  style={[styles.productCard, qty > 0 && styles.productCardActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${p.name} to sale, KSh ${p.price}`}
                >
                  <Text style={styles.productEmoji}>{p.emoji}</Text>
                  <Text style={styles.productName}>{p.name}</Text>
                  <Text style={styles.productPrice}>KSh {p.price}</Text>
                  {qty > 0 ? (
                    <Animated.View key={qty} entering={ZoomIn.springify().damping(12)} style={styles.qtyBadge}>
                      <Text style={styles.qtyBadgeText}>{qty}</Text>
                    </Animated.View>
                  ) : null}
                </AnimatedPressable>
              </Animated.View>
            );
          })}
        </View>

        {itemCount === 0 && phase === 'pick' ? <PulsingHint text="Tap a product to sell it" /> : null}

        {/* Receipt */}
        {phase === 'receipt' ? (
          <Animated.View entering={FadeInUp.duration(500).springify().damping(16)} style={styles.receipt}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptShop}>DUKA LA AMANI</Text>
              <Text style={styles.receiptMeta}>Receipt #0001 · {new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <View style={styles.receiptDivider} />
            {soldItems.map((p) => (
              <View key={p.id} style={styles.receiptRow}>
                <Text style={styles.receiptItem}>
                  {p.name} × {cart[p.id]}
                </Text>
                <Text style={styles.receiptItem}>KSh {p.price * (cart[p.id] ?? 0)}</Text>
              </View>
            ))}
            <View style={styles.receiptDivider} />
            <View style={styles.receiptRow}>
              <Text style={styles.receiptTotal}>TOTAL</Text>
              <Text style={styles.receiptTotal}>KSh {cartTotal}</Text>
            </View>
            <View style={styles.paidStamp}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={styles.paidStampText}>PAID · M-PESA</Text>
            </View>
          </Animated.View>
        ) : null}

        {phase === 'receipt' ? (
          <Animated.View entering={FadeInUp.duration(450).delay(350)}>
            <Text style={styles.ahaText}>
              That took seconds — and your sales, stock and profit updated themselves.
            </Text>
            <AnimatedPressable
              onPress={() => {
                haptics.medium();
                router.push(isGuest ? '/(onboarding)/signup' : '/(onboarding)/personalize');
              }}
              style={styles.continueBtn}
              accessibilityRole="button"
            >
              <Text style={styles.continueBtnText}>
                {isGuest ? 'Create my shop' : 'Continue'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </AnimatedPressable>
            <AnimatedPressable onPress={reset} style={styles.replayBtn} accessibilityRole="button">
              <Ionicons name="refresh" size={15} color={Colors.textSecondary} />
              <Text style={styles.replayText}>Sell again</Text>
            </AnimatedPressable>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Cart bar */}
      {phase === 'pick' && itemCount > 0 ? (
        <Animated.View entering={FadeInUp.duration(300).springify().damping(18)} exiting={FadeOut.duration(150)} style={styles.cartBar}>
          <View>
            <Text style={styles.cartCount}>
              {itemCount} item{itemCount > 1 ? 's' : ''}
            </Text>
            <Text style={styles.cartTotal}>KSh {cartTotal.toLocaleString()}</Text>
          </View>
          <AnimatedPressable onPress={charge} style={styles.chargeBtn} accessibilityRole="button">
            <Ionicons name="phone-portrait-outline" size={16} color="#FFFFFF" />
            <Text style={styles.chargeBtnText}>Charge with M-PESA</Text>
          </AnimatedPressable>
        </Animated.View>
      ) : null}

      {/* STK push overlay */}
      {phase === 'stk' || phase === 'paid' ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(250)} style={styles.overlay}>
          <Animated.View entering={FadeInUp.duration(350).springify().damping(17)} style={styles.stkCard}>
            {phase === 'stk' ? (
              <>
                <View style={styles.stkIconWrap}>
                  <Ionicons name="phone-portrait-outline" size={26} color={Colors.primary} />
                </View>
                <Text style={styles.stkTitle}>Asking the customer to pay…</Text>
                <Text style={styles.stkSub}>M-PESA prompt sent to 0712 345 678</Text>
                <ActivityIndicator color={Colors.primary} style={styles.stkSpinner} />
              </>
            ) : (
              <>
                <Animated.View entering={ZoomIn.springify().damping(11)} style={[styles.stkIconWrap, styles.stkIconSuccess]}>
                  <Ionicons name="checkmark" size={30} color="#FFFFFF" />
                </Animated.View>
                <Text style={styles.stkTitle}>Payment received</Text>
                <Text style={[styles.stkSub, { color: Colors.success }]}>
                  +KSh {cartTotal.toLocaleString()} · M-PESA confirmed
                </Text>
              </>
            )}
          </Animated.View>
        </Animated.View>
      ) : null}

      {phase === 'receipt' ? <Confetti count={26} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  tryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accentSubtle,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tryPillText: {
    color: Colors.accentDark,
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 1,
  },
  skip: {
    color: Colors.primary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },
  title: {
    fontSize: Typography.size.h1,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...Shadows.sm,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },
  statValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridItem: { width: '48%', flexGrow: 1 },
  productCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  productCardActive: { borderColor: Colors.primary },
  productEmoji: { fontSize: 34 },
  productName: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    marginTop: 6,
  },
  productPrice: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  qtyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  qtyBadgeText: { color: '#FFFFFF', fontSize: 12, fontFamily: Typography.fontFamilyBold },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.lg,
  },
  hintText: {
    color: Colors.primary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  cartBar: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.xl,
    paddingVertical: 12,
    paddingLeft: Spacing.md,
    paddingRight: 12,
    ...Shadows.lg,
  },
  cartCount: { color: 'rgba(248,250,252,0.6)', fontSize: 11, fontFamily: Typography.fontFamily },
  cartTotal: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamilyBold,
    fontVariant: ['tabular-nums'],
  },
  chargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  chargeBtnText: { color: '#FFFFFF', fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  stkCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sheet,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    ...Shadows.lg,
  },
  stkIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  stkIconSuccess: { backgroundColor: Colors.success },
  stkTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  stkSub: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  stkSpinner: { marginTop: Spacing.md },
  receipt: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.md,
  },
  receiptHeader: { alignItems: 'center' },
  receiptShop: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  receiptMeta: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  receiptDivider: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  receiptItem: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  receiptTotal: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  paidStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: Colors.success,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: Spacing.sm,
    transform: [{ rotate: '-3deg' }],
  },
  paidStampText: {
    color: Colors.success,
    fontSize: 11,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: 1,
  },
  ahaText: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    lineHeight: 23,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  replayText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
