import React from 'react';
import { Stack } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/Colors';

export default function ShiftsLayout() {
  return (
    <Stack
      screenOptions={{
        header: ({ route, options }) => (
          <ScreenHeader title={options.title ?? route.name} fallbackHref="/(owner)/dashboard" />
        ),
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Shifts' }} />
      <Stack.Screen name="[id]" options={{ title: 'Shift Report' }} />
    </Stack>
  );
}
