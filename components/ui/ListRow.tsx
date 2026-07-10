import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from './AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Plain icon, no tinted circle background — keep icons informational, not decorative. */
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  /** Custom content on the right, e.g. an amount or a status label. */
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  /** Suppresses the bottom hairline — set on the last row in a list. */
  isLast?: boolean;
  style?: ViewStyle;
}

/**
 * Flat row with a bottom hairline, no card/shadow — the standard list-item
 * pattern used across products, staff, expenses, transactions, etc. so every
 * list in the app reads the same way instead of each screen wrapping rows in
 * its own shadowed Card.
 */
export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  icon,
  iconColor = Colors.textSecondary,
  trailing,
  chevron = false,
  onPress,
  isLast = false,
  style,
}) => {
  const content = (
    <Animated.View
      style={[styles.row, !isLast && styles.divider, style]}
      entering={FadeIn.duration(Motion.duration.base)}
      exiting={FadeOut.duration(Motion.duration.fast)}
      layout={LinearTransition.duration(Motion.duration.slow)}
    >
      {icon && <Ionicons name={icon} size={20} color={iconColor} style={styles.icon} />}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {trailing}
      {chevron && <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} style={styles.chevron} />}
    </Animated.View>
  );

  if (onPress) {
    return <AnimatedPressable onPress={onPress}>{content}</AnimatedPressable>;
  }

  return content;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  icon: { marginRight: Spacing.sm },
  info: { flex: 1, marginRight: Spacing.sm },
  title: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  subtitle: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
  chevron: { marginLeft: Spacing.xs },
});
