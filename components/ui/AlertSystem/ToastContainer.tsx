import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '../AnimatedPressable';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import type { ToastConfig, ToastType } from '@/context/AlertContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Toast extends ToastConfig {
  id: string;
}

export interface ToastContainerRef {
  addToast: (config: ToastConfig) => void;
}

// ─── Per-type visual config ────────────────────────────────────────────────────

const TOAST_CONFIG: Record<
  ToastType,
  { icon: string; color: string; bg: string; border: string }
> = {
  success: {
    icon: 'checkmark-circle',
    color: Colors.success,
    bg: '#FFFFFF',
    border: Colors.success,
  },
  error: {
    icon: 'close-circle',
    color: Colors.error,
    bg: '#FFFFFF',
    border: Colors.error,
  },
  warning: {
    icon: 'warning',
    color: Colors.warning,
    bg: '#FFFFFF',
    border: Colors.warning,
  },
  info: {
    icon: 'information-circle',
    color: Colors.info,
    bg: '#FFFFFF',
    border: Colors.info,
  },
};

const DEFAULT_DURATION = 3200;
const MAX_TOASTS = 3;

// ─── Single Toast Item ────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
  index: number;
}

function ToastItem({ toast, onRemove, index }: ToastItemProps) {
  const cfg = TOAST_CONFIG[toast.type];
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remove = useCallback(() => {
    onRemove(toast.id);
  }, [toast.id, onRemove]);

  // Animate in on mount
  React.useLayoutEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 280, mass: 0.7 });
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withSpring(1, { damping: 20, stiffness: 280 });

    // Feel the outcome without reading it — meaningful states only, so a
    // burst of info toasts never turns into vibration noise.
    if (toast.type === 'success') haptics.success();
    else if (toast.type === 'error') haptics.error();
    else if (toast.type === 'warning') haptics.warning();

    const duration = toast.duration ?? DEFAULT_DURATION;
    timerRef.current = setTimeout(() => {
      animateOut();
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const animateOut = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
    scale.value = withTiming(0.96, { duration: 200 });
    translateY.value = withTiming(-40, { duration: 200 }, (finished) => {
      if (finished) runOnJS(remove)();
    });
  }, [remove]);

  const containerAnim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(22).stiffness(260)}
      style={[styles.toast, containerAnim]}
    >
      {/* Left accent stripe */}
      <View style={[styles.stripe, { backgroundColor: cfg.border }]} />

      <View style={styles.toastInner}>
        <View style={[styles.toastIconWrap, { backgroundColor: cfg.border + '18' }]}>
          <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
        </View>
        <Text style={styles.toastMessage} numberOfLines={2}>
          {toast.message}
        </Text>
        <AnimatedPressable
          onPress={animateOut}
          pressScale={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <Ionicons name="close" size={15} color={Colors.textTertiary} style={styles.toastClose} />
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

export const ToastContainer = forwardRef<ToastContainerRef, object>(
  function ToastContainer(_props, ref) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const insets = useSafeAreaInsets();

    const addToast = useCallback((config: ToastConfig) => {
      const id = `toast_${Date.now()}_${Math.random()}`;
      setToasts((prev) => {
        const next = [{ ...config, id }, ...prev];
        return next.slice(0, MAX_TOASTS);
      });
    }, []);

    const removeToast = useCallback((id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    useImperativeHandle(ref, () => ({ addToast }), [addToast]);

    if (toasts.length === 0) return null;

    return (
      <View
        style={[styles.container, { top: insets.top + Spacing.sm }]}
        pointerEvents="box-none"
      >
        {toasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={removeToast}
            index={index}
          />
        ))}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
    gap: Spacing.xs,
    pointerEvents: 'box-none',
  },
  toast: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    // Premium shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stripe: {
    width: 3,
  },
  toastInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 13,
    gap: Spacing.sm,
  },
  toastIconWrap: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  toastMessage: {
    flex: 1,
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: Typography.size.small,
    color: Colors.textPrimary,
    lineHeight: Typography.lineHeight.small,
  },
  toastClose: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});
