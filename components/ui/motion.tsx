import React from 'react';
import { Platform, UIManager, View } from 'react-native';
import { EaseView, type EaseViewProps } from 'react-native-ease';
import { Motion } from '@/constants/Motion';

/**
 * React Native Ease motion primitives — declarative enter/ambient animations
 * that run on Core Animation (iOS) / Animator (Android) with zero JS overhead.
 * Reanimated stays in charge of gestures and layout; these cover the simple
 * "fade/slide into place" and looping-ambience cases.
 */

// EaseView is a Fabric native component, so it only exists in binaries built
// after react-native-ease was added — never in Expo Go, and not in dev clients
// from before the dependency. Mounting it there throws, so fall back to a
// static View (content shows without the animation) until the app is rebuilt.
const easeViewAvailable = (() => {
  if (Platform.OS === 'web') return true; // pure-JS implementation
  try {
    return UIManager.hasViewManagerConfig?.('EaseView') ?? false;
  } catch {
    return false;
  }
})();

/** Static stand-in: strips Ease-only props and renders a plain View. */
const StaticView: React.FC<EaseViewProps> = ({
  animate,
  initialAnimate,
  transition,
  onTransitionEnd,
  useHardwareLayer,
  transformOrigin,
  ...viewProps
}) => <View {...viewProps} />;

const MotionView = easeViewAvailable ? EaseView : StaticView;

interface ScreenFadeProps extends EaseViewProps {
  /** Extra px of upward settle; 0 for a pure crossfade. */
  rise?: number;
  /** Stagger start, ms. */
  delay?: number;
}

/**
 * Screen/section entrance — content fades in and settles upward into place on
 * mount. Wrap the top-level container of a screen (or a late-loading section)
 * instead of hand-rolling opacity animations per screen.
 */
export const ScreenFade: React.FC<ScreenFadeProps> = ({
  rise = 8,
  delay = 0,
  children,
  ...rest
}) => (
  <MotionView
    initialAnimate={{ opacity: 0, translateY: rise }}
    animate={{ opacity: 1, translateY: 0 }}
    transition={{ type: 'timing', duration: Motion.duration.slow + 120, easing: 'easeOut', delay }}
    {...rest}
  >
    {children}
  </MotionView>
);

interface CrossfadeCircleProps extends EaseViewProps {
  /** Phase of the breathing loop: 'in' starts dim → bright, 'out' the reverse. */
  phase?: 'in' | 'out';
  /** Full half-cycle duration in ms. */
  duration?: number;
}

/**
 * Ambient decorative circle — slowly crossfades in a reversing loop. Pair two
 * with opposite phases so one breathes in while the other breathes out.
 * Runs natively; pointerEvents disabled so it never intercepts touches.
 */
export const CrossfadeCircle: React.FC<CrossfadeCircleProps> = ({
  phase = 'in',
  duration = 4200,
  ...rest
}) => (
  <MotionView
    pointerEvents="none"
    initialAnimate={{ opacity: phase === 'in' ? 0.25 : 1, scale: phase === 'in' ? 0.94 : 1.06 }}
    animate={{ opacity: phase === 'in' ? 1 : 0.25, scale: phase === 'in' ? 1.06 : 0.94 }}
    transition={{ type: 'timing', duration, easing: 'easeInOut', loop: 'reverse' }}
    {...rest}
  />
);
