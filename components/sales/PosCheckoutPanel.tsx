import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, type LayoutChangeEvent } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/**
 * The open sale, pinned to the bottom of the till.
 *
 * It used to live in the product list's ListHeaderComponent, which put the
 * whole thing — every line, the payment buttons and Complete Sale — above the
 * catalogue. Adding a fourth item meant scrolling up past the cart to reach
 * the products and back down to pay, on the screen a shop runs a hundred
 * times a day. Pinning it costs the catalogue some height and gives back the
 * two things a cashier needs never to hunt for: what the customer owes, and
 * the button that finishes it.
 *
 * The line list collapses. Four items is where it stops being a glance and
 * starts being a scroll, so past that the header alone carries the count and
 * the catalogue keeps its room; the cashier opens it to check or remove.
 */

interface PosCheckoutPanelProps {
  itemCount: number;
  /** Cart lines. Rendered in a capped, scrollable area. */
  lines: React.ReactNode;
  /** The total/payment/checkout block. */
  summary: React.ReactNode;
  /** Clearance for the app's floating tab bar. */
  bottomInset: number;
  /** Reports the panel's height so the catalogue can clear it. */
  onHeightChange: (height: number) => void;
}

/** About three lines. Past that the area scrolls rather than growing. */
const MAX_LINES_HEIGHT = 138;

/** Item count at which the list starts collapsed. */
const COLLAPSE_FROM = 4;

export const PosCheckoutPanel: React.FC<PosCheckoutPanelProps> = ({
  itemCount,
  lines,
  summary,
  bottomInset,
  onHeightChange,
}) => {
  const [manuallyToggled, setManuallyToggled] = useState<boolean | null>(null);
  const expanded = manuallyToggled ?? itemCount < COLLAPSE_FROM;

  const onLayout = (e: LayoutChangeEvent) => onHeightChange(e.nativeEvent.layout.height);

  return (
    <KeyboardAvoidingView behavior="padding" style={[s.wrap, { bottom: bottomInset }]}>
      <View style={s.panel} onLayout={onLayout}>
        <AnimatedPressable
          onPress={() => { haptics.light(); setManuallyToggled(!expanded); }}
          style={s.header}
          pressScale={0.995}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`This sale, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
          accessibilityHint={expanded ? 'Hides the item list' : 'Shows the item list'}
        >
          <Text style={s.headerTitle}>This sale</Text>
          <Text style={s.headerCount}>
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={Colors.textSecondary}
          />
        </AnimatedPressable>

        {expanded && (
          <ScrollView
            style={s.lines}
            contentContainerStyle={s.linesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {lines}
          </ScrollView>
        )}

        <View style={s.summary}>{summary}</View>
      </View>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    // One soft lift to separate the panel from the catalogue behind it. The
    // border does most of the work; the shadow only says "this floats".
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
  },
  headerTitle: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerCount: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  lines: {
    maxHeight: MAX_LINES_HEIGHT,
    flexGrow: 0,
  },
  linesContent: { paddingBottom: 4 },
  summary: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
});
