import React from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPercent?: number;
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
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent accessibilityViewIsModal>
      {/* RNGH pressables inside a RN Modal need their own gesture root on Android */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        {/* A plain View here (not KeyboardAvoidingView) so the sheet is
            bottom-anchored on the very first frame — Modal centers its
            content by default until a child claims full height, and
            KeyboardAvoidingView doesn't get real layout/keyboard data until
            its first keyboard event, so wrapping the whole overlay in it
            used to show the sheet centered for a frame (fixed the instant a
            field was focused and the keyboard fired). Keyboard avoidance now
            only wraps the sheet itself, which needs it. */}
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          {/* Always 'padding', not the usual iOS-padding/Android-height split:
              'height' shrinks whatever it wraps by the keyboard's height, which
              only makes sense wrapping a full screen — wrapping just this sheet,
              a short sheet's own height can be smaller than the keyboard's,
              going negative and silently skipping the adjustment entirely. */}
          <KeyboardAvoidingView behavior="padding">
            <View
              style={[
                styles.sheet,
                { maxHeight: `${maxHeightPercent}%`, paddingBottom: Spacing.xl + insets.bottom },
              ]}
            >
              <View style={styles.handle} />
              {children}
            </View>
          </KeyboardAvoidingView>
        </View>
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
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
});
