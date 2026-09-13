import React from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/**
 * The open sale, anchored to the bottom edge of the till.
 *
 * Three things earn permanent screen height on a POS, and only three: what
 * the customer owes, how they are paying, and the button that ends it. The
 * first version of this panel also carried a section header, a collapse
 * chevron and the whole line list, which meant adding a single item replaced
 * half the catalogue with a form. The lines moved to a sheet behind a tap on
 * the total — the only reason to read them is to fix something — and the
 * header and chevron went away entirely.
 *
 * Anchored at bottom: 0 and carrying the safe-area inset itself, the way a
 * sheet sits on the screen edge, rather than floating above the tab bar with
 * the catalogue showing through the gap.
 */

interface PosCheckoutPanelProps {
  /** Total, payment methods and the checkout button. */
  children: React.ReactNode;
  /** Reports the panel's height so the catalogue can clear it. */
  onHeightChange: (height: number) => void;
}

export const PosCheckoutPanel: React.FC<PosCheckoutPanelProps> = ({ children, onHeightChange }) => {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior="padding" style={s.wrap}>
      <View
        style={[s.panel, { paddingBottom: Spacing.md + insets.bottom }]}
        onLayout={(e: LayoutChangeEvent) => onHeightChange(e.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    // One soft lift to separate it from the catalogue behind. The border does
    // most of the work; the shadow only says "this floats".
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
});
