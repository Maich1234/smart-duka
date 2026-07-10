import React from 'react';
import { Text, StyleSheet, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { openHelp } from '@/utils/openHelp';

interface HelpLinkProps {
  slug: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const HelpLink: React.FC<HelpLinkProps> = ({ slug, label = 'Learn more', style, textStyle }) => {
  return (
    <AnimatedPressable
      style={[styles.row, style]}
      onPress={() => openHelp(slug)}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Ionicons name="help-circle-outline" size={14} color={Colors.primary} />
      <Text style={[styles.text, textStyle]}>{label}</Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: Spacing.xs },
  text: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});
