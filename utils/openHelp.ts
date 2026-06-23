import { Platform, Linking } from 'react-native';
import { router } from 'expo-router';
import { HELP_CENTER_URL } from '@/constants/config';

// The Help & Learning Center only ships in the web build (app/help/*.web.tsx
// is excluded from native bundles by the .web extension) — on iOS/Android,
// route there by opening the hosted web export in the browser instead.
export function openHelp(slug?: string) {
  const path = slug ? `/help/${slug}` : '/help';
  if (Platform.OS === 'web') {
    router.push(path as any);
  } else {
    Linking.openURL(`${HELP_CENTER_URL}${path}`);
  }
}
