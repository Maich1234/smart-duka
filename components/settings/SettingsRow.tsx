import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

/**
 * One row inside a SettingsCard — an icon, a title/subtitle, and either a
 * `right` control (a Switch, most often) or, with `onPress`, a chevron.
 * Ported verbatim from the styling profile.tsx's old flat "Preferences"
 * card used, so splitting settings into per-category screens didn't change
 * how any of it looks.
 */
interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  /** Tints the subtitle to match e.g. a subscription warning — the row's
   * icon already carries iconColor/iconBg for the same tone; this is the
   * text-side counterpart, bolded to read as an actual warning rather than
   * a color the eye can skim past. */
  subtitleColor?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  iconColor = Colors.primary,
  iconBg = Colors.primarySubtle,
  title,
  subtitle,
  subtitleColor,
  right,
  onPress,
  accessibilityLabel,
}) => {
  const content = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text
            style={[
              styles.sub,
              subtitleColor ? { color: subtitleColor, fontFamily: Typography.fontFamilySemiBold } : null,
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} /> : null)}
    </>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        style={styles.row}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
};

/** Divider between two SettingsRows inside the same SettingsCard. */
export const SettingsRowDivider: React.FC = () => <View style={styles.divider} />;

/** Rounded card container for a group of SettingsRows. */
export const SettingsCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.card}>{children}</View>
);

/** Small uppercase label above a SettingsCard, or standalone screen intro copy. */
export const SettingsSectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <Text style={styles.sectionLabel}>{label}</Text>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.md },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  sub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    lineHeight: 20,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
});
