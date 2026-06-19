import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { APP_NAME } from '@/constants/config';

export const AuthHeader: React.FC<{ style?: object }> = ({ style }) => (
  <View style={[styles.container, style]}>
    <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
    <Text style={styles.appName}>{APP_NAME}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginBottom: Spacing.sm,
  },
  appName: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
    letterSpacing: 0.3,
  },
});
