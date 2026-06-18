import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { Spacing } from '@/constants/Spacing';

const { width: screenWidth } = Dimensions.get('window');

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 100, borderRadius = 12, style }) => {
  const { colors } = useTheme();
  return (
    <View style={[{ width, height, borderRadius, overflow: 'hidden' }, style]}>
      <LinearGradient
        colors={[colors.border, colors.surface, colors.border]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </View>
  );
};

export const DashboardSkeleton = () => (
  <View style={{ padding: Spacing.md }}>
    <Skeleton width={150} height={24} style={{ marginBottom: Spacing.sm }} />
    <Skeleton width={200} height={32} style={{ marginBottom: Spacing.lg }} />
    <Skeleton height={180} style={{ marginBottom: Spacing.md }} />
    <View style={{ flexDirection: 'row', gap: Spacing.md }}>
      <Skeleton width={screenWidth * 0.28} height={80} />
      <Skeleton width={screenWidth * 0.28} height={80} />
      <Skeleton width={screenWidth * 0.28} height={80} />
    </View>
  </View>
);