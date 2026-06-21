import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Button } from './Button';

interface ErrorStateProps {
  title: string;
  subtitle?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title, subtitle, onRetry }) => {
  return (
    <View style={styles.container}>
      <LottieView
        source={require('@/assets/lottie/error-alert.json')}
        autoPlay
        loop={false}
        style={styles.animation}
      />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {onRetry ? <Button title="Try Again" onPress={onRetry} variant="outline" size="sm" style={styles.button} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  animation: { width: 100, height: 100 },
  title: {
    fontFamily: Typography.fontFamilySemiBold,
    fontSize: Typography.size.body,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  subtitle: {
    fontFamily: Typography.fontFamily,
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  button: { marginTop: Spacing.md, minWidth: 140 },
});
