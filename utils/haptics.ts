import * as ExpoHaptics from 'expo-haptics';

/**
 * Haptics facade — Pulsar (react-native-pulsar) when its native module is
 * present, expo-haptics otherwise. The fallback keeps haptics working on dev
 * clients built before Pulsar was added and on web; once the app is rebuilt
 * (`expo run:android` / EAS), Pulsar takes over automatically.
 */
type PulsarPresets = typeof import('react-native-pulsar').Presets;

let Presets: PulsarPresets | null = null;
try {
  // Runtime require (not a static import) so a binary built before Pulsar was
  // added throws here and we fall back, instead of crashing at startup.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Presets = require('react-native-pulsar').Presets;
  if (typeof Presets?.System.impactLight !== 'function') Presets = null;
} catch {
  Presets = null;
}

const run = (pulsar: (() => void) | undefined, expo: () => Promise<void>) => {
  try {
    if (Presets && pulsar) {
      pulsar();
      return;
    }
  } catch {
    // Native call failed — degrade to expo-haptics below.
  }
  expo().catch(() => {});
};

export const haptics = {
  /** Button presses, tab selection — the default tap feedback. */
  light: () =>
    run(Presets?.System.impactLight, () =>
      ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light)
    ),
  /** Confirming actions with weight — checkout, saving a form. */
  medium: () =>
    run(Presets?.System.impactMedium, () =>
      ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium)
    ),
  /** Filter changes, toggles, pickers scrolling through options. */
  selection: () => run(Presets?.System.selection, () => ExpoHaptics.selectionAsync()),
  /** Completed payment, successful sync, product saved. */
  success: () =>
    run(Presets?.System.notificationSuccess, () =>
      ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success)
    ),
  /** Insufficient stock, offline mode, destructive confirmation prompts. */
  warning: () =>
    run(Presets?.System.notificationWarning, () =>
      ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning)
    ),
  /** Failed payment, failed sync, validation errors. */
  error: () =>
    run(Presets?.System.notificationError, () =>
      ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error)
    ),
};
