import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        // headerBackTitleVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Sign In',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Create Account',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: 'Reset Password',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}