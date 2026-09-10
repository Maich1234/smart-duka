import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';
import { BorderRadius } from '@/constants/BorderRadius';

interface CardProps extends ViewProps {
  /** Defaults to flat (no shadow) — reserve 'sm'/'md'/'lg' for elements that
   * actually float above content, like sheets and pinned panels. */
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  /** Adds a 1px hairline border instead of a shadow for separation. */
  bordered?: boolean;
  padding?: keyof typeof Spacing;
  onPress?: () => void;
  /** Read by screen readers in place of the card's raw child text when it's tappable. */
  accessibilityLabel?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  elevation = 'none',
  bordered = false,
  padding = 'md',
  onPress,
  style,
  accessibilityLabel,
  ...props
}) => {
  const paddingValue = Spacing[padding as keyof typeof Spacing] as number;
  const shadowValue = elevation === 'none' ? undefined : Shadows[elevation as keyof typeof Shadows];

  const content = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: Colors.surface,
          padding: paddingValue,
          borderWidth: bordered ? 1 : 0,
          borderColor: Colors.border,
          ...shadowValue,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <AnimatedPressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        {content}
      </AnimatedPressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
});
