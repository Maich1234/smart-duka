import React, { useEffect, useState } from 'react';
import { Modal, View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 800;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPercent?: number;
  /**
   * Actions pinned below the body, always on screen.
   *
   * A sheet that scrolls puts its buttons at the end of the scroll, so the
   * one thing the sheet exists to do — confirm, save, close — is reachable
   * only after reading everything above it. Worse on a small screen and worse
   * again at a large font size, which is exactly where the body is longest.
   * Passing them here keeps them in place while the body scrolls under them.
   */
  footer?: React.ReactNode;
  dismissible?: boolean;
}

/**
 * Native bottom-sheet chrome shared by all contextual-action modals (forms,
 * confirmations, detail views) — anchored to the bottom edge with rounded top
 * corners and a drag handle, matching iOS/Android sheet conventions instead of
 * a centered web-style dialog box. Also centralizes keyboard avoidance so
 * individual sheets don't each need their own KeyboardAvoidingView.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  children,
  maxHeightPercent = 90,
  footer,
  dismissible = true,
}) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [availableHeight, setAvailableHeight] = useState(height);
  const close = () => { if (dismissible) onClose(); };
  const maxHeight = Math.max(0, Math.min(
    height * Math.min(100, Math.max(1, maxHeightPercent)) / 100,
    availableHeight - insets.top - Spacing.sm,
  ));
  const dragY = useSharedValue(0);

  // The handle glyph has always visually promised a drag-to-dismiss gesture
  // that was never wired up. Reset on every open, not just declared once —
  // this component doesn't unmount between hide/show (Modal's `visible` is
  // what toggles), so a leftover drag offset from the last close would
  // otherwise show the sheet's content briefly displaced downward.
  //
  // dragY isn't declared as a dependency: Reanimated shared values have a
  // stable identity across renders, and listing it here would make the
  // compiler treat the gesture handlers' worklet mutations of dragY.value
  // below as unsafe ("cannot be modified").
  useEffect(() => {
    if (visible) dragY.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Scoped to the handle only, not the whole sheet — the sheet's own content
  // (forms, scrollable lists) must keep its normal touch/scroll behavior.
  // On a successful dismiss this hands off to the same `onClose` the overlay
  // tap already uses, so the Modal's own tested slide-out animation plays
  // rather than a second, custom exit animation racing it.
  //
  // react-hooks/immutability treats dragY as frozen once the reset effect
  // above touches it, but mutating `.value` is the whole point of a
  // Reanimated shared value — same false positive, same fix, as
  // VerificationModal's handleSheetLayout/closeWith.
  const dragGesture = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((event) => {
      if (event.translationY > 0) {
        // eslint-disable-next-line react-hooks/immutability
        dragY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) runOnJS(onClose)();
      // eslint-disable-next-line react-hooks/immutability
      dragY.value = withSpring(0, { damping: 20, stiffness: 300 });
    });

  const dragAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close} statusBarTranslucent accessibilityViewIsModal>
      {/* RNGH pressables inside a RN Modal need their own gesture root on Android */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <KeyboardAvoidingView behavior="padding" style={styles.gestureRoot}>
          <View
            style={styles.overlay}
            onLayout={(event) => setAvailableHeight(event.nativeEvent.layout.height)}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              disabled={!dismissible}
            />
            <Animated.View
              style={[
                styles.sheet,
                { maxHeight, paddingBottom: Spacing.xl + insets.bottom },
                dragAnimStyle,
              ]}
            >
              <GestureDetector gesture={dragGesture}>
                <View style={styles.handleZone}>
                  <View style={styles.handle} />
                </View>
              </GestureDetector>
              {children}
              {!!footer && <View style={styles.footer}>{footer}</View>}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  body: { flexShrink: 1, minHeight: 0 },
  footer: {
    flexShrink: 0,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: Spacing.sm,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
    // Without this a child that overruns the sheet's maxHeight paints outside
    // the card — over the rounded corners, and over whatever sits below it.
    overflow: 'hidden',
  },
  handleZone: {
    // The visual handle is 4px tall — much smaller than a real touch/drag
    // target. This widens the grabbable area without changing what's drawn;
    // paddingBottom matches the handle's old marginBottom so the gap above
    // the sheet's content is unchanged.
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
});

/**
 * A sheet's scrolling body, sized to give up height to a pinned footer rather
 * than pushing it off the screen.
 *
 * Use it with `SheetFooter` for sheets whose actions live inside a separate
 * body component (the mount-on-open pattern), where the `footer` prop on
 * BottomSheet is out of scope. The two produce the same layout.
 */
export const SheetScrollBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ScrollView
    style={styles.body}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="on-drag"
    showsVerticalScrollIndicator={false}
  >
    {children}
  </ScrollView>
);

/** Actions pinned under a `SheetScrollBody`. Matches BottomSheet's `footer`. */
export const SheetFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.footer}>{children}</View>
);
