import React from 'react';
import { Stack } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTheme } from '@/hooks/useTheme';

export default function SettingsStackLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        header: ({ route, options }) => (
          <ScreenHeader title={options.title ?? route.name} fallbackHref="/(owner)/profile" />
        ),
        contentStyle: { backgroundColor: colors.background },
      }}
      screenListeners={({ navigation }) => ({
        // This nested Stack lives under a hidden tab, so React Navigation
        // keeps it mounted (and its history intact) across visits — a
        // category pushed on a previous visit stays stranded below the one
        // pushed next. Separately, since no `initialRouteName` is set,
        // navigating straight to any non-`business` screen makes React
        // Navigation silently prepend `business` (the first declared
        // Stack.Screen) below it too. Either way an extra entry ends up
        // under the current screen, so `router.back()` pops into it instead
        // of falling through to fallbackHref. None of these screens ever
        // navigate to one another (always entered fresh from the Settings
        // hub in profile.tsx, always exited back to it), so on focus we
        // just drop everything below the current screen.
        focus: () => {
          const state = navigation.getState();
          if (state.index > 0) {
            navigation.reset({ ...state, index: 0, routes: [state.routes[state.index]] });
          }
        },
      })}
    >
      <Stack.Screen name="business" options={{ title: 'Business' }} />
      <Stack.Screen name="pos-sales" options={{ title: 'POS & Sales' }} />
      <Stack.Screen name="scanning" options={{ title: 'Scanning' }} />
      <Stack.Screen name="inventory" options={{ title: 'Inventory' }} />
      <Stack.Screen name="staff-security" options={{ title: 'Staff & Security' }} />
      <Stack.Screen name="integrations" options={{ title: 'Integrations' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notification Settings' }} />
      <Stack.Screen name="data-reports" options={{ title: 'Data & Reports' }} />
      <Stack.Screen name="ai" options={{ title: 'DuQana AI' }} />
    </Stack>
  );
}
