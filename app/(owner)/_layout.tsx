import React, { useEffect } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { haptics } from '@/utils/haptics';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useAuth } from '@/context/AuthContext';
import { Typography } from '@/constants/Typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TabConfig {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}

const TAB_CONFIGS: TabConfig[] = [
  { name: 'dashboard', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { name: 'inventory', label: 'Stock', icon: 'cube-outline', activeIcon: 'cube' },
  { name: 'sales', label: 'Sales', icon: 'cart-outline', activeIcon: 'cart' },
  { name: 'staff', label: 'Staff', icon: 'people-outline', activeIcon: 'people' },
  { name: 'profile', label: 'Me', icon: 'person-outline', activeIcon: 'person' },
];

const TAB_COUNT = TAB_CONFIGS.length;
const TAB_WIDTH = SCREEN_WIDTH / TAB_COUNT;

interface AnimatedTabIconProps {
  config: TabConfig;
  isFocused: boolean;
}

const AnimatedTabIcon: React.FC<AnimatedTabIconProps> = ({ config, isFocused }) => {
  const scale = useSharedValue(isFocused ? 1 : 0.9);
  const translateY = useSharedValue(isFocused ? -2 : 0);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.1 : 0.95, {
      damping: 14,
      stiffness: 160,
    });
    translateY.value = withSpring(isFocused ? -2 : 0, {
      damping: 14,
      stiffness: 160,
    });
  }, [isFocused, scale, translateY]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View style={iconStyle}>
      <Ionicons
        name={isFocused ? config.activeIcon : config.icon}
        size={22}
        color={isFocused ? '#0F766E' : '#94A3B8'}
      />
    </Animated.View>
  );
};

interface PremiumTabBarProps {
  state: {
    routes: Array<{ key: string; name: string }>;
    index: number;
  };
  descriptors: Record<string, { options: { title?: string; href?: null } }>;
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (args: { name: string; merge: boolean }) => void;
  };
}

const PremiumTabBar: React.FC<PremiumTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  // Build list of only the visible routes (matching our TAB_CONFIGS)
  const visibleRoutes = state.routes.filter((route) =>
    TAB_CONFIGS.some((tc) => tc.name === route.name),
  );

  // Active tab index within the visible set
  const activeRoute = state.routes[state.index];
  const activeVisibleIndex = visibleRoutes.findIndex((r) => r.name === activeRoute?.name);

  // Sliding indicator position
  const indicatorX = useSharedValue(activeVisibleIndex >= 0 ? activeVisibleIndex * TAB_WIDTH : 0);

  useEffect(() => {
    if (activeVisibleIndex >= 0) {
      indicatorX.value = withSpring(activeVisibleIndex * TAB_WIDTH, {
        damping: 20,
        stiffness: 200,
        mass: 0.8,
      });
    }
  }, [activeVisibleIndex, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const tabBarHeight = 58 + insets.bottom;

  return (
    <View style={[styles.tabBar, { height: tabBarHeight }]}>
      {/* Background layer */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={85}
          tint="light"
          style={[StyleSheet.absoluteFill, styles.blurBase]}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.androidBase]} />
      )}

      {/* Top border accent */}
      <View style={styles.topBorderLine} />

      {/* Sliding pill indicator */}
      <Animated.View
        style={[styles.pillContainer, indicatorStyle, { pointerEvents: 'none' }]}
      >
        <View style={styles.pill} />
      </Animated.View>

      {/* Tab items */}
      <View style={[styles.tabsRow, { paddingBottom: insets.bottom }]}>
        {visibleRoutes.map((route) => {
          const config = TAB_CONFIGS.find((tc) => tc.name === route.name)!;
          const isFocused = route.name === activeRoute?.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              haptics.light();
              navigation.navigate({ name: route.name, merge: true });
            }
          };

          return (
            <AnimatedPressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={config.label}
            >
              <AnimatedTabIcon config={config} isFocused={isFocused} />
              <Animated.Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? '#0F766E' : '#94A3B8' },
                  isFocused && styles.tabLabelActive,
                ]}
              >
                {config.label}
              </Animated.Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
};

export default function OwnerLayout() {
  const { user, isLoading } = useAuth();

  if (!isLoading && (!user || user.role !== 'owner')) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <PremiumTabBar {...(props as unknown as PremiumTabBarProps)} />}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: '#0F172A',
        headerTitleStyle: {
          fontFamily: Typography.fontFamilySemiBold,
          fontSize: Typography.size.body,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Smart Duka',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Sales',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="staff"
        options={{
          title: 'Staff',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          href: null,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'M-Pesa Transactions',
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  blurBase: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  androidBase: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  topBorderLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(241,245,249,0.9)',
  },
  pillContainer: {
    position: 'absolute',
    top: 6,
    left: 0,
    width: TAB_WIDTH,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  pill: {
    width: TAB_WIDTH * 0.55,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0F766E',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingBottom: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamily,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    fontFamily: Typography.fontFamilySemiBold,
  },
});
