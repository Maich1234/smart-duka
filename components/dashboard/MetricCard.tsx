import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend }) => {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
      {trend && (
        <Text style={[styles.trend, { color: trend.positive ? Colors.success : Colors.danger }]}>
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { padding: Spacing.md, alignItems: 'center', flex: 1, marginHorizontal: 4 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  icon: { marginRight: Spacing.xs },
  title: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center' },
  value: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, textAlign: 'center' },
  trend: { fontSize: Typography.size.caption, marginTop: Spacing.xs, textAlign: 'center' },
});