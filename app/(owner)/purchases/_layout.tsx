import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

export default function PurchasesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: {
          fontFamily: Typography.fontFamilySemiBold,
          fontSize: Typography.size.body,
        },
        headerShadowVisible: false,
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
