import React from 'react';
import { Platform, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: readonly Edge[];
  backgroundColor?: string;
  contentContainerStyle?: ViewStyle | ViewStyle[];
  style?: ViewStyle;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
  /**
   * Reserve room for the floating tab bar. On for screens inside the owner
   * and staff tab navigators — the bar is absolutely positioned, so without
   * this the last card or button ends up underneath it. Replaces the bottom
   * safe-area edge rather than stacking with it.
   */
  tabBarSpacing?: boolean;
}

/**
 * Standard screen root combining safe-area insets, platform-correct keyboard
 * avoidance, and (optionally) a tap-friendly ScrollView — so every screen and
 * form gets correct keyboard/notch handling without re-deriving it locally.
 */
export const Screen: React.FC<ScreenProps> = ({
  children,
  scroll = true,
  padded = true,
  edges = ['top', 'bottom', 'left', 'right'],
  backgroundColor = Colors.background,
  contentContainerStyle,
  style,
  keyboardShouldPersistTaps = 'handled',
  tabBarSpacing = false,
}) => {
  const tabBarHeight = useTabBarHeight();
  // The tab bar already covers the bottom inset, so keeping that edge here
  // would double-count it.
  const resolvedEdges = tabBarSpacing ? edges.filter((e) => e !== 'bottom') : edges;
  const bottomSpace = tabBarSpacing ? { paddingBottom: tabBarHeight + Spacing.md } : null;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor }, style]} edges={resolvedEdges as Edge[]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[padded && styles.padded, bottomSpace, contentContainerStyle]}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, padded && styles.padded, bottomSpace, contentContainerStyle]}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { padding: Spacing.lg },
});
