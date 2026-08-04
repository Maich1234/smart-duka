import React, { useCallback } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useNavigation, type Href } from 'expo-router';
import { AnimatedPressable } from './AnimatedPressable';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { BorderRadius } from '@/constants/BorderRadius';

interface BackButtonProps {
  /** Overrides the default "pop the stack" behaviour. */
  onPress?: () => void;
  /**
   * Where to go when there is nothing to pop — a deep link opened straight
   * into this screen, or the first screen of a tab. Without one the button
   * hides itself rather than rendering a control that does nothing.
   */
  fallbackHref?: Href;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * The single back affordance in the app.
 *
 * Every screen that isn't a tab root gets this exact control — same glyph,
 * same size, same position — whether the header is drawn by a navigator or by
 * the screen itself. Screens used to be a mix of native stack headers (with a
 * back arrow), tab screens reached by `router.push` (without one), and custom
 * headers that simply forgot, which left several screens with no way out but
 * the tab bar.
 */
export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  fallbackHref,
  color = Colors.textPrimary,
  style,
  accessibilityLabel = 'Go back',
}) => {
  const navigation = useNavigation();

  const handlePress = useCallback(() => {
    haptics.light();
    if (onPress) {
      onPress();
      return;
    }
    if (navigation.canGoBack()) {
      router.back();
      return;
    }
    // `replace`, not `push`: with no history there is nothing to return to,
    // so leaving this screen on the stack would strand the user in a loop.
    if (fallbackHref) router.replace(fallbackHref);
  }, [fallbackHref, navigation, onPress]);

  // Nothing to go back to and no fallback — render nothing rather than a
  // dead control.
  if (!onPress && !fallbackHref && !navigation.canGoBack()) return null;

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="chevron-back" size={24} color={color} />
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    marginLeft: -8,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
