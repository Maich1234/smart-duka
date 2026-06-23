import React from 'react';
import { Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AnimatedPressable } from './AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  haptic = true,
}) => {
  const handlePress = () => {
    if (haptic && !disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const getBackgroundColor = () => {
    if (disabled) return Colors.disabledBackground;
    switch (variant) {
      case 'primary': return Colors.primary;
      case 'secondary': return Colors.divider;
      case 'danger': return Colors.danger;
      default: return 'transparent';
    }
  };

  const getTextColor = () => {
    if (disabled) return Colors.textDisabled;
    switch (variant) {
      case 'primary':
      case 'danger':
        return '#FFFFFF';
      case 'secondary':
        return Colors.textPrimary;
      case 'outline':
      case 'ghost':
        return Colors.primary;
      default:
        return '#FFFFFF';
    }
  };

  const getBorderColor = () => {
    if (variant === 'outline') return Colors.primary;
    return 'transparent';
  };

  const paddingVertical = {
    sm: Spacing.sm,
    md: Spacing.md,
    lg: Spacing.lg,
  };

  const paddingHorizontal = {
    sm: Spacing.md,
    md: Spacing.lg,
    lg: Spacing.xl,
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 1 : 0,
          paddingVertical: paddingVertical[size],
          paddingHorizontal: paddingHorizontal[size],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text
          style={[
            styles.text,
            {
              color: getTextColor(),
              fontSize: size === 'sm' ? Typography.size.small : size === 'md' ? Typography.size.body : Typography.size.h3,
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontFamily: Typography.fontFamilySemiBold,
    textAlign: 'center',
  },
});