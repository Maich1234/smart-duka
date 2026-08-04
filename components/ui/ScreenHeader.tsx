import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { BackButton } from './BackButton';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { HEADER_HEIGHT } from '@/constants/Layout';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Defaults to true; pass false on the first screen of a tab. */
  showBack?: boolean;
  onBack?: () => void;
  /** Destination when the screen was opened with no history behind it. */
  fallbackHref?: Href;
  /** Action buttons rendered at the trailing edge. */
  right?: React.ReactNode;
  /** The screen's own container already applies the top inset. */
  insetTop?: boolean;
  /** Hairline under the header — off for screens that scroll under it. */
  bordered?: boolean;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's one header.
 *
 * Used two ways, deliberately identical in both: as the `header` renderer for
 * the tab and stack navigators (so screens get it for free), and directly by
 * screens that draw their own chrome — a scroll-aware list, a till, a chat
 * thread. Anything reached by navigation shows `BackButton` in the same slot,
 * so "how do I get out of here" has a single answer everywhere.
 */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  showBack = true,
  onBack,
  fallbackHref,
  right,
  insetTop = true,
  bordered = true,
  backgroundColor = Colors.surface,
  style,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor, paddingTop: insetTop ? insets.top : 0 },
        bordered && styles.bordered,
        style,
      ]}
    >
      <View style={styles.row}>
        {showBack ? <BackButton onPress={onBack} fallbackHref={fallbackHref} /> : null}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.actions}>{right}</View> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%' },
  bordered: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  row: {
    minHeight: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  titleWrap: { flex: 1, justifyContent: 'center' },
  title: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
