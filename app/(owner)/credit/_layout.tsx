import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function CreditStackLayout() {
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
      <Stack.Screen name="opening-balances" options={{ title: 'Bring Forward a Debt' }} />
    </Stack>
  );
}
