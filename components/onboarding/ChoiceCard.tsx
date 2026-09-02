import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface ChoiceCardProps {
  label: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  /** Multi-select renders a square check; single renders a filled dot. Only
   *  affects the 'row' variant's mark — 'tile' always shows the same badge. */
  multi?: boolean;
  /** 'row' (default): full-width list row. 'tile': square product-card
   *  layout matching the till grid in the first-sale demo, meant to sit in a
   *  wrapping 2-column grid. */
  variant?: 'row' | 'tile';
  style?: ViewStyle;
}

/** Tappable answer card for the personalization quiz and setup pickers —
 *  springs on press, pops a check when selected. */
export const ChoiceCard: React.FC<ChoiceCardProps> = ({
  label,
  subtitle,
  icon,
  selected,
  onPress,
  multi = false,
  variant = 'row',
  style,
}) => {
  const handlePress = () => {
    haptics.selection();
    onPress();
  };

  if (variant === 'tile') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        pressScale={0.95}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        style={[styles.tile, selected && styles.tileSelected, style]}
      >
        {icon ? (
          <View style={[styles.tileIconWrap, selected && styles.tileIconWrapSelected]}>
            <Ionicons name={icon} size={20} color={selected ? Colors.primary : Colors.textSecondary} />
          </View>
        ) : null}
        <Text style={[styles.tileLabel, selected && styles.tileLabelSelected]} numberOfLines={2}>
          {label}
        </Text>
        {selected ? (
          <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.tileCheck}>
            <Ionicons name="checkmark" size={12} color={Colors.white} />
          </Animated.View>
        ) : null}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      pressScale={0.97}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.card, selected && styles.cardSelected, style]}
    >
      {icon ? (
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
          <Ionicons name={icon} size={18} color={selected ? Colors.primary : Colors.textSecondary} />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={2}>
          {label}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.mark, multi && styles.markSquare, selected && styles.markSelected]}>
        {selected ? (
          <Animated.View entering={ZoomIn.springify().damping(14)}>
            <Ionicons name="checkmark" size={13} color={Colors.white} />
          </Animated.View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: { backgroundColor: Colors.surface },
  textWrap: { flex: 1 },
  label: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  labelSelected: { color: Colors.primaryDark },
  subtitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markSquare: { borderRadius: 7 },
  markSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tile: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    minHeight: 100,
  },
  tileSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  tileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconWrapSelected: { backgroundColor: Colors.surface },
  tileLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  tileLabelSelected: { color: Colors.primaryDark },
  tileCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
