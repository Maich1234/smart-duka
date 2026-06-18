import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface AccountInfoProps {
  name: string;
  email: string;
  role: string;
}

export const AccountInfo: React.FC<AccountInfoProps> = ({ name, email, role }) => {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Account Information</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Name:</Text>
        <Text style={styles.value}>{name}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Email:</Text>
        <Text style={styles.value}>{email}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Role:</Text>
        <Text style={styles.value}>{role === 'owner' ? 'Shop Owner' : 'Staff'}</Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.lg },
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilySemiBold, marginBottom: Spacing.md, color: Colors.textPrimary },
  row: { flexDirection: 'row', marginBottom: Spacing.xs },
  label: { width: 80, fontSize: Typography.size.body, color: Colors.textSecondary },
  value: { flex: 1, fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
});