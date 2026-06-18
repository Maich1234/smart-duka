import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Redirect } from 'expo-router';

export default function StaffLayout() {
  const { colors, isDark } = useTheme();
  const { user, isLoading } = useAuth();

  // Redirect if not staff
  if (!isLoading && (!user || user.role !== 'staff')) {
    return <Redirect href="/(auth)/login" />;
  }

  const tabBarStyle = Platform.select({
    ios: {
      position: 'absolute' as const,
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      elevation: 0,
    },
    android: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      elevation: 8,
    },
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle,
        tabBarBackground: () =>
          Platform.OS === 'ios' ? <BlurView intensity={90} style={{ flex: 1 }} /> : null,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Stock',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Sales',
          tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}