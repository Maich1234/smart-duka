import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { haptics } from '@/utils/haptics';
import { AnimatedPressable } from '../AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import type { AlertConfig, AlertButton } from '@/context/AlertContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DIALOG_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);

// ─── Per-type visual config ────────────────────────────────────────────────────

const TYPE_CONFIG = {
  success: {
    iconBg: Colors.successSubtle,
    iconColor: Colors.success,
    accentColor: Colors.success,
  },
  error: {
    iconBg: Colors.dangerSubtle,
    iconColor: Colors.error,
    accentColor: Colors.error,
  },
  warning: {
    iconBg: Colors.warningSubtle,
    iconColor: Colors.warning,
    accentColor: Colors.warning,
  },
  info: {
    iconBg: '#DBEAFE',
    iconColor: Colors.info,
    accentColor: Colors.info,
  },
  confirm: {
    iconBg: Colors.primarySubtle,
    iconColor: Colors.primary,
    accentColor: Colors.primary,
  },
} as const;

// ─── Animated success checkmark (SVG stroke draw) ─────────────────────────────

const AnimatedPath = Animated.createAnimatedComponent(Path);

function SuccessCheckmark({ color }: { color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  // strokeDasharray total ≈ 34 for this path at 40×40 viewBox
  const DASH_LENGTH = 34;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: DASH_LENGTH * (1 - progress.value),
  }));

  return (
    <Svg width={36} height={36} viewBox="0 0 40 40">
      <AnimatedPath
        d="M8 21 L16 29 L32 11"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={DASH_LENGTH}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

// ─── Icon area ────────────────────────────────────────────────────────────────

function AlertIcon({ type }: { type: AlertConfig['type'] }) {
  const cfg = TYPE_CONFIG[type];
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (type === 'success') {
      pulse.value = withSpring(1.15, { damping: 6, stiffness: 200 }, () => {
        pulse.value = withSpring(1, { damping: 12, stiffness: 200 });
      });
    }
  }, [type]);

  const iconScale = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.iconWrap,
        { backgroundColor: cfg.iconBg },
        iconScale,
      ]}
    >
      {type === 'success' ? (
        <SuccessCheckmark color={cfg.iconColor} />
      ) : type === 'error' ? (
        <Ionicons name="close-circle" size={32} color={cfg.iconColor} />
      ) : type === 'warning' ? (
        <Ionicons name="warning" size={32} color={cfg.iconColor} />
      ) : type === 'info' ? (
        <Ionicons name="information-circle" size={32} color={cfg.iconColor} />
      ) : (
        <Ionicons name="help-circle" size={32} color={cfg.iconColor} />
      )}
    </Animated.View>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

function DialogButton({
  button,
  onDismiss,
  isOnly,
}: {
  button: AlertButton;
  onDismiss: () => void;
  isOnly: boolean;
}) {
  const handlePress = () => {
    button.onPress?.();
    onDismiss();
  };

  const variant = button.variant ?? 'primary';

  const bgColor = {
    primary: Colors.primary,
    secondary: Colors.divider,
    danger: Colors.error,
    ghost: 'transparent',
  }[variant];

  const textColor = {
    primary: Colors.white,
    secondary: Colors.textPrimary,
    danger: Colors.white,
    ghost: Colors.primary,
  }[variant];

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[
        styles.btn,
        isOnly && styles.btnFull,
        { backgroundColor: bgColor },
        variant === 'ghost' && styles.btnGhost,
      ]}
    >
      <Text style={[styles.btnText, { color: textColor }]}>{button.label}</Text>
    </AnimatedPressable>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface AlertModalProps {
  config: AlertConfig | null;
  visible: boolean;
  onDismiss: () => void;
}

export function AlertModal({ config, visible, onDismiss }: AlertModalProps) {
  // Keep a local copy so content stays visible during dismiss animation
  const [localConfig, setLocalConfig] = useState<AlertConfig | null>(null);
  const [modalMounted, setModalMounted] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.86);
  const translateY = useSharedValue(16);

  const animateIn = () => {
    opacity.value = withTiming(1, { duration: 180 });
    scale.value = withSpring(1, { damping: 22, stiffness: 320, mass: 0.8 });
    translateY.value = withSpring(0, { damping: 22, stiffness: 320 });
  };

  const animateOut = (callback: () => void) => {
    opacity.value = withTiming(0, { duration: 140 });
    scale.value = withTiming(0.92, { duration: 140 });
    translateY.value = withTiming(8, { duration: 140 });
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(callback, 155);
  };

  useEffect(() => {
    if (visible && config) {
      setLocalConfig(config);
      setModalMounted(true);
      // Small delay so modal mounts before animation starts
      requestAnimationFrame(() => {
        opacity.value = 0;
        scale.value = 0.86;
        translateY.value = 16;
        requestAnimationFrame(animateIn);
      });

      // Haptics
      if (config.type === 'error') {
        haptics.error();
      } else if (config.type === 'success') {
        haptics.success();
      } else if (config.type === 'warning') {
        haptics.warning();
      } else {
        haptics.medium();
      }

      // Auto-dismiss
      if (config.autoDismiss) {
        dismissTimerRef.current = setTimeout(() => {
          animateOut(onDismiss);
        }, config.autoDismiss);
      }
    } else if (!visible && modalMounted) {
      animateOut(() => {
        setModalMounted(false);
        onDismiss();
      });
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [visible]);

  const overlayAnim = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const cardAnim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  if (!modalMounted || !localConfig) return null;

  const cfg = TYPE_CONFIG[localConfig.type];

  const handleDismiss = () => {
    // User tapped a button — animate out, then notify parent
    animateOut(onDismiss);
  };

  const defaultButtons: AlertButton[] =
    localConfig.buttons ??
    (localConfig.type === 'confirm'
      ? [
          { label: 'Cancel', variant: 'ghost' },
          { label: 'Confirm', variant: 'primary' },
        ]
      : [{ label: 'OK', variant: 'primary' }]);

  const canDismissOnOverlay = localConfig.type !== 'confirm';

  return (
    <Modal
      visible={modalMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      accessibilityViewIsModal
      onRequestClose={canDismissOnOverlay ? handleDismiss : undefined}
    >
      {/* RNGH pressables inside a RN Modal need their own gesture root on Android */}
      <GestureHandlerRootView style={styles.gestureRoot}>
      {/* Overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayAnim]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={canDismissOnOverlay ? handleDismiss : undefined}
        />
      </Animated.View>

      {/* Card */}
      <View style={styles.centeredContainer} pointerEvents="box-none">
        <Animated.View style={[styles.card, cardAnim]}>
          {/* Top accent line */}
          <View style={[styles.accentLine, { backgroundColor: cfg.accentColor }]} />

          <View style={styles.body}>
            <AlertIcon type={localConfig.type} />

            <Text style={styles.title}>{localConfig.title}</Text>
            {localConfig.message ? (
              <Text style={styles.message}>{localConfig.message}</Text>
            ) : null}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Buttons */}
          <View
            style={[
              styles.buttonRow,
              defaultButtons.length === 1 && styles.buttonRowCentered,
            ]}
          >
            {defaultButtons.map((btn, i) => (
              <DialogButton
                key={i}
                button={btn}
                onDismiss={handleDismiss}
                isOnly={defaultButtons.length === 1}
              />
            ))}
          </View>
        </Animated.View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    backgroundColor: Colors.overlay,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: DIALOG_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  accentLine: {
    height: 3,
    width: '100%',
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: Typography.size.h3,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.h3,
  },
  message: {
    fontFamily: Typography.fontFamily,
    fontSize: Typography.size.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.body,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  buttonRowCentered: {
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: {
    flex: 1,
    maxWidth: 180,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnText: {
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: Typography.size.body,
  },
});
