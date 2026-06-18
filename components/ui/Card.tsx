import React from 'react';
import { View, TouchableOpacity, ViewProps, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

interface CardProps extends ViewProps {
  elevation?: 'sm' | 'md' | 'lg';
  padding?: keyof typeof Spacing;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  elevation = 'md',
  padding = 'md',
  onPress,
  style,
  ...props
}) => {
  const paddingValue = Spacing[padding as keyof typeof Spacing] as number;
  const shadowValue = Shadows[elevation as keyof typeof Shadows];

  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: Colors.surface, padding: paddingValue, ...shadowValue },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
