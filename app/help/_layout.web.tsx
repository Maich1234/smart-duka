import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function HelpLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Help & Learning Center' }} />
      <Stack.Screen name="[slug]" options={{ title: 'Help' }} />
    </Stack>
  );
}
