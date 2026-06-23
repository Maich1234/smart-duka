import { useEffect } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { HELP_CENTER_URL } from '@/constants/config';

// Native fallback for app/help/index.web.tsx. Entry points already call
// openHelp(), which opens the browser directly on native and never
// navigates here — this only exists to satisfy expo-router's requirement
// that every platform-specific route file have a non-suffixed sibling, and
// to fail safely if something ever links to /help directly.
export default function HelpIndexNativeFallback() {
  useEffect(() => {
    Linking.openURL(`${HELP_CENTER_URL}/help`);
    router.back();
  }, []);

  return null;
}
