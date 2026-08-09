import React from 'react';
import { Stack, usePathname } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTheme } from '@/hooks/useTheme';

export default function SettingsStackLayout() {
  const { colors } = useTheme();
  // This nested Stack lives under a hidden tab, and React Navigation keeps a
  // tab's nested navigator state alive across visits — so whichever category
  // got pushed first (e.g. Scanning) stays stranded at the bottom of its
  // history forever, and every other category pushed afterward reveals it on
  // the way back instead of the hub. None of these screens are ever chained
  // to one another (always entered fresh from the Settings hub in
  // profile.tsx, always exited back to it) — keying the Stack by pathname
  // forces React to tear down and rebuild it on every category visit, so it
  // never carries history it shouldn't, and `router.back()` correctly finds
  // nothing to pop and falls through to fallbackHref every time.
  const pathname = usePathname();

  return (
    <Stack
      key={pathname}
      screenOptions={{
        header: ({ route, options }) => (
          <ScreenHeader title={options.title ?? route.name} fallbackHref="/(owner)/profile" />
        ),
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="business" options={{ title: 'Business' }} />
      <Stack.Screen name="pos-sales" options={{ title: 'POS & Sales' }} />
      <Stack.Screen name="scanning" options={{ title: 'Scanning' }} />
      <Stack.Screen name="inventory" options={{ title: 'Inventory' }} />
      <Stack.Screen name="staff-security" options={{ title: 'Staff & Security' }} />
      <Stack.Screen name="integrations" options={{ title: 'Integrations' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notification Settings' }} />
      <Stack.Screen name="data-reports" options={{ title: 'Data & Reports' }} />
      <Stack.Screen name="ai" options={{ title: 'Dukana AI' }} />
    </Stack>
  );
}
