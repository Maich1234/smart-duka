import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, type TextStyle, type StyleProp } from 'react-native';
import { Easing, ReduceMotion, useAnimatedReaction, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { formatCurrency } from '@/utils/formatters';

interface AnimatedBalanceProps {
  value: number;
  currency?: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

/**
 * The one number on a customer's account that is worth animating.
 *
 * When a repayment lands, the balance moving is the confirmation that the money
 * actually went somewhere — a figure that simply swaps between two values leaves
 * the cashier checking twice. Counting from the old figure to the new one shows
 * the change happening, and shows its direction.
 *
 * Three rules keep it from becoming decoration:
 *  • It animates on *change* only. A balance that counts up every time the
 *    screen opens is a loading animation pretending to be information.
 *  • It eases out exponentially and lands in under half a second — long enough
 *    to read as movement, short enough that nobody waits for a number.
 *  • Reduce Motion cuts straight to the value. Reanimated's own ReduceMotion
 *    setting is honoured on the worklet, so the system preference wins without
 *    this component polling for it.
 */
export const AnimatedBalance: React.FC<AnimatedBalanceProps> = ({
  value,
  currency,
  style,
  accessibilityLabel,
}) => {
  const progress = useSharedValue(value);
  const [displayed, setDisplayed] = useState(value);
  // First render must paint the real figure, never a count-up from zero.
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      progress.value = value;
      setDisplayed(value);
      return;
    }
    progress.value = withTiming(value, {
      duration: 420,
      // Exponential ease-out: most of the distance is covered immediately, so
      // the figure reads as settling rather than as ticking over.
      easing: Easing.out(Easing.exp),
      reduceMotion: ReduceMotion.System,
    });
    // A screen reader is told the result, not the journey.
    AccessibilityInfo.announceForAccessibility(
      `Balance ${formatCurrency(value, currency)}`,
    );
    // progress is a Reanimated shared value with a stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency]);

  // Rounded to whole shillings while in flight: animating cents produces a blur
  // of digits nobody can read, and the final frame carries the exact figure.
  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (current !== previous) runOnJS(setDisplayed)(current);
    },
  );

  const settled = Math.abs(displayed - value) < 1 ? value : displayed;

  return (
    <Text
      style={style}
      accessibilityLabel={accessibilityLabel ?? `Balance ${formatCurrency(value, currency)}`}
      // The figure is re-rendered many times a second while animating; without
      // this a screen reader would try to read every frame.
      accessibilityLiveRegion="none"
    >
      {formatCurrency(settled, currency)}
    </Text>
  );
};
