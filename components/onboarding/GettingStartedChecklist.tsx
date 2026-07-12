import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp, ZoomIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { getProducts } from '@/services/products';
import { getSales } from '@/services/sales';
import { getStaff } from '@/services/staff';
import { getPaymentStatus } from '@/services/paymentConfig';
import { useOnboardingStore } from '@/store/onboardingStore';
import { haptics } from '@/utils/haptics';
import { Motion } from '@/constants/Motion';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

interface ChecklistStatus {
  hasProducts: boolean;
  hasSales: boolean;
  hasMpesa: boolean;
  hasStaff: boolean;
}

/** Each probe is independent — one failing endpoint shouldn't sink the card. */
const fetchStatus = async (): Promise<ChecklistStatus> => {
  const [products, sales, mpesa, staff] = await Promise.allSettled([
    getProducts({ page: 1, limit: 1 }),
    getSales({ page: 1, limit: 1 }),
    getPaymentStatus(),
    getStaff({ page: 1, limit: 1 }),
  ]);
  return {
    hasProducts:
      products.status === 'fulfilled' && (products.value.pagination?.total ?? 0) > 0,
    hasSales: sales.status === 'fulfilled' && (sales.value.pagination?.total ?? 0) > 0,
    hasMpesa: mpesa.status === 'fulfilled' && Boolean(mpesa.value.data?.mpesa?.isConfigured),
    hasStaff: staff.status === 'fulfilled' && (staff.value.pagination?.total ?? 0) > 0,
  };
};

const ProgressBar: React.FC<{ fraction: number }> = ({ fraction }) => {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withSpring(fraction, Motion.spring.enter);
  }, [fraction]);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, style]} />
    </View>
  );
};

/** Whether this JS session ever saw the checklist with open tasks — decides
 *  if completing the last task earns a celebration or a quiet retirement.
 *  Module-scoped (not a ref) so it can be read during render. */
let sawIncompleteThisSession = false;

/**
 * "First week" checklist on the owner dashboard — reflects real shop state
 * (not tapped-through tutorial steps), routes each task to the screen where
 * it happens, and retires itself once the shop is running.
 */
export const GettingStartedChecklist: React.FC = () => {
  const { checklistDismissed, dismissChecklist } = useOnboardingStore();

  const { data } = useQuery({
    queryKey: ['onboardingChecklist'],
    queryFn: fetchStatus,
    staleTime: 60_000,
    enabled: !checklistDismissed,
  });

  const resolvedAllDone =
    !!data && data.hasProducts && data.hasSales && data.hasMpesa && data.hasStaff;

  // A shop that was already fully set up before this card ever rendered
  // doesn't need a congratulations for old news — retire quietly.
  useEffect(() => {
    if (!data) return;
    if (resolvedAllDone && !sawIncompleteThisSession) dismissChecklist();
    if (!resolvedAllDone) sawIncompleteThisSession = true;
  }, [data, resolvedAllDone, dismissChecklist]);

  if (checklistDismissed || !data) return null;
  if (resolvedAllDone && !sawIncompleteThisSession) return null;

  const tasks = [
    {
      key: 'products',
      done: data.hasProducts,
      icon: 'cube' as const,
      title: 'Add your first product',
      sub: 'Build your catalogue',
      route: '/(owner)/inventory/new',
    },
    {
      key: 'sale',
      done: data.hasSales,
      icon: 'cart' as const,
      title: 'Make your first sale',
      sub: 'Watch the books update themselves',
      route: '/(owner)/sales',
    },
    {
      key: 'mpesa',
      done: data.hasMpesa,
      icon: 'phone-portrait' as const,
      title: 'Connect M-PESA',
      sub: 'Get paid straight to your till',
      route: '/(owner)/payments',
    },
    {
      key: 'staff',
      done: data.hasStaff,
      icon: 'people' as const,
      title: 'Invite your team',
      sub: 'Give staff their own logins',
      route: '/(owner)/staff',
    },
  ];

  const doneCount = tasks.filter((t) => t.done).length;
  const allDone = doneCount === tasks.length;

  if (allDone) {
    return (
      <Animated.View entering={FadeInUp.duration(420)} style={styles.card}>
        <View style={styles.doneWrap}>
          <Animated.View entering={ZoomIn.springify().damping(11)} style={styles.doneCheck}>
            <Ionicons name="checkmark" size={22} color="#FFFFFF" />
          </Animated.View>
          <View style={styles.doneTextWrap}>
            <Text style={styles.title}>Your shop is fully set up 🎉</Text>
            <Text style={styles.sub}>Products, sales, M-PESA and your team — all running.</Text>
          </View>
        </View>
        <AnimatedPressable
          onPress={() => {
            haptics.success();
            dismissChecklist();
          }}
          style={styles.doneBtn}
          accessibilityRole="button"
        >
          <Text style={styles.doneBtnText}>Nice — hide this</Text>
        </AnimatedPressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.duration(420)} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Get your shop running</Text>
          <Text style={styles.sub}>
            {doneCount} of {tasks.length} done
          </Text>
        </View>
        <AnimatedPressable
          onPress={() => {
            haptics.light();
            dismissChecklist();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Hide getting started checklist"
        >
          <Ionicons name="close" size={18} color={Colors.textTertiary} />
        </AnimatedPressable>
      </View>

      <ProgressBar fraction={doneCount / tasks.length} />

      <View style={styles.list}>
        {tasks.map((task) => (
          <AnimatedPressable
            key={task.key}
            onPress={() => {
              if (task.done) return;
              haptics.light();
              router.push(task.route as Parameters<typeof router.push>[0]);
            }}
            disabled={task.done}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={task.title}
            accessibilityState={{ checked: task.done }}
          >
            <View style={[styles.rowCheck, task.done && styles.rowCheckDone]}>
              {task.done ? (
                <Animated.View entering={ZoomIn.springify().damping(12)}>
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                </Animated.View>
              ) : (
                <Ionicons name={task.icon} size={13} color={Colors.primary} />
              )}
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, task.done && styles.rowTitleDone]}>{task.title}</Text>
              {!task.done ? <Text style={styles.rowSub}>{task.sub}</Text> : null}
            </View>
            {!task.done ? (
              <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
            ) : null}
          </AnimatedPressable>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    ...Shadows.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  headerText: { flex: 1 },
  title: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  sub: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  rowCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCheckDone: { backgroundColor: Colors.success },
  rowText: { flex: 1 },
  rowTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  rowTitleDone: {
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  rowSub: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  doneWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneCheck: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTextWrap: { flex: 1 },
  doneBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.successSubtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginTop: Spacing.sm,
    marginLeft: 52,
  },
  doneBtnText: {
    color: Colors.success,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
