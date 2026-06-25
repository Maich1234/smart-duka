import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { APP_NAME } from '@/constants/config';

interface AuthHeaderProps {
  headline: string;
  description?: string;
  style?: object;
  centered?: boolean;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({
  headline,
  description,
  style,
  centered = false,
}) => (
  <View style={[styles.container, centered && styles.containerCentered, style]}>
    <View style={[styles.brandRow, centered && styles.brandRowCentered]}>
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
      <Text style={styles.appName}>{APP_NAME}</Text>
    </View>
    <Text style={[styles.headline, centered && styles.textCentered]}>{headline}</Text>
    {description ? (
      <Text style={[styles.description, centered && styles.textCentered]}>{description}</Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  containerCentered: {
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  brandRowCentered: {
    justifyContent: 'center',
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    marginRight: 9,
  },
  appName: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    letterSpacing: -0.2,
  },
  headline: {
    fontSize: 30,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    lineHeight: 36,
    marginBottom: 6,
  },
  description: {
    fontSize: 15,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  textCentered: {
    textAlign: 'center',
  },
});
