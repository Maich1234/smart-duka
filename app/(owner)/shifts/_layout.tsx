import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

export default function ShiftsLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Shifts' }} />
      <Stack.Screen name="[id]" options={{ title: 'Shift Report' }} />
    </Stack>
  );
}
