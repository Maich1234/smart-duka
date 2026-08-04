import React from 'react';
import { Stack } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/Colors';

export default function PurchasesLayout() {
  return (
    <Stack
      screenOptions={{
        header: ({ route, options }) => (
          <ScreenHeader title={options.title ?? route.name} fallbackHref="/(staff)/dashboard" />
        ),
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Purchasing' }} />
      <Stack.Screen name="new" options={{ title: 'New Purchase' }} />
      <Stack.Screen name="history" options={{ title: 'Purchase History' }} />
      <Stack.Screen name="[id]" options={{ title: 'Purchase Details' }} />
      <Stack.Screen name="suppliers" options={{ title: 'Suppliers' }} />
      <Stack.Screen name="reports" options={{ title: 'Purchase Reports' }} />
    </Stack>
  );
}
