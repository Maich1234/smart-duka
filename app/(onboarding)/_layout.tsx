import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Scene } from '@/components/onboarding/theme';

/**
 * Guided onboarding journey — dark cinematic "moment" screens bookend light
 * interactive ones, so cross-fades (not slides) keep the sequence feeling
 * like one continuous scene rather than a stack of pages.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: Scene.bgFrom },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="demo" options={{ contentStyle: { backgroundColor: Colors.background } }} />
      <Stack.Screen
        name="personalize"
        options={{ contentStyle: { backgroundColor: Colors.background } }}
      />
      <Stack.Screen name="preparing" options={{ gestureEnabled: false }} />
      <Stack.Screen name="setup" options={{ contentStyle: { backgroundColor: Colors.background } }} />
      <Stack.Screen
        name="permissions"
        options={{ contentStyle: { backgroundColor: Colors.background } }}
      />
      <Stack.Screen name="signup" options={{ contentStyle: { backgroundColor: Colors.surface } }} />
      <Stack.Screen name="celebrate" options={{ gestureEnabled: false }} />
      <Stack.Screen name="activate" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
