import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface StaffCardProps {
  staff: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
  };
  onEdit: () => void;
  onResetPassword: () => void;
  onPermissions: () => void;
  onDelete: () => void;
}

export const StaffCard: React.FC<StaffCardProps> = ({
  staff,
  onEdit,
  onResetPassword,
  onPermissions,
  onDelete,
}) => {
  return (
    <Card style={styles.card}>
      <View style={styles.content}>
        <View style={styles.info}>
          <Text style={styles.name}>{staff.name}</Text>
          <Text style={styles.email}>{staff.email}</Text>
          {staff.phone && <Text style={styles.phone}>{staff.phone}</Text>}
          <View style={styles.statusBadge}>
            <Text style={[styles.status, { color: staff.isActive ? Colors.success : Colors.danger }]}>
              {staff.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
            <Ionicons name="pencil-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onResetPassword} style={styles.actionBtn}>
            <Ionicons name="key-outline" size={22} color={Colors.warning} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onPermissions} style={styles.actionBtn}>
            <Ionicons name="shield-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={22} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.md, marginVertical: Spacing.xs, padding: Spacing.md },
  content: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info: { flex: 1 },
  name: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  email: { fontSize: Typography.size.small, color: Colors.textSecondary },
  phone: { fontSize: Typography.size.small, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { marginTop: 4 },
  status: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { padding: Spacing.xs },
});