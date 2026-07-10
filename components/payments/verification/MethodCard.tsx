import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface MethodCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  destination: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}

/** Tappable delivery-channel row for the method chooser. */
export const MethodCard: React.FC<MethodCardProps> = ({
  icon,
  title,
  destination,
  loading,
  disabled,
  onPress,
}) => (
  <AnimatedPressable
    style={[styles.card, disabled && !loading && styles.cardDisabled]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={`${title}, code will be sent to ${destination}`}
    accessibilityState={{ disabled, busy: loading }}
  >
    <View style={styles.iconWrap}>
      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Ionicons name={icon} size={18} color={Colors.primary} />
      )}
    </View>
    <View style={styles.text}>
      <Text style={styles.title} maxFontSizeMultiplier={1.6}>
        {title}
      </Text>
      <Text style={styles.destination} numberOfLines={1} ellipsizeMode="middle">
        {destination}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
  </AnimatedPressable>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md - 2,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm + 4,
    minHeight: 68,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  destination: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
});
