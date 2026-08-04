import React from 'react';
import { Stack } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/Colors';

export default function PurchasesLayout() {
  return (
    <Stack
      screenOptions={{
        // Shared header. `index` is the root of this stack but is itself
        // pushed on top of a tab, so ScreenHeader's back button resolves
        // against the parent navigator instead of disappearing.
        header: ({ route, options }) => (
          <ScreenHeader title={options.title ?? route.name} fallbackHref="/(owner)/dashboard" />
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
