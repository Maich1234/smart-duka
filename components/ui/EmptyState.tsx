import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, subtitle }) => {
  return (
    <View style={styles.container}>
      <LottieView
        source={require('@/assets/lottie/empty-box.json')}
        autoPlay
        loop
        style={styles.animation}
      />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  animation: { width: 120, height: 120 },
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
});
