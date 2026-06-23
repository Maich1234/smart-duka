import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface SectionProps {
  title?: string;
  /** Optional control rendered next to the title, e.g. a "see all" link. */
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Title + flat content block with consistent vertical rhythm — replaces the
 * pattern of wrapping every section in its own shadowed Card. Sections sit
 * directly on the screen background; spacing alone separates them.
 */
export const Section: React.FC<SectionProps> = ({ title, action, children, style }) => (
  <View style={[styles.container, style]}>
    {(title || action) && (
      <View style={styles.header}>
        {title ? <Text style={styles.title}>{title}</Text> : <View />}
        {action}
      </View>
    )}
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  title: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: Typography.letterSpacing.wide },
});
