import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

/**
 * Mirrors the owner's inventory stack. Staff reach `new` and `[id]/edit` only
 * when they hold `create_product` / `edit_product`; the list gates the links
 * and each screen re-checks, so a stale deep link can't slip through.
 */
export default function StaffInventoryStackLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/edit" options={{ headerShown: false }} />
    </Stack>
  );
}
