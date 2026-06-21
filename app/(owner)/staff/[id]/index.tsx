import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getStaffById, deleteStaff, resetStaffPassword, getAllPermissions, type Permission } from '@/services/staff';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ResetPasswordModal } from '@/components/staff/ResetPasswordModal';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function StaffDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const [resetModalVisible, setResetModalVisible] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => getStaffById(id),
  });

  const { data: permissionsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: getAllPermissions,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      router.back();
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to delete staff'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (newPassword: string) => resetStaffPassword(id, newPassword),
    onSuccess: () => { setResetModalVisible(false); Alert.alert('Success', 'Password reset'); },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to reset password'),
  });

  const handleDelete = () => {
    Alert.alert('Confirm', `Remove ${data?.data.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  if (isLoading || !data) {
    return <LoadingState />;
  }

  const staff = data.data;
  const allPermissions: Permission[] = permissionsData?.data || [];
  const grouped = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]}>
      <Card style={styles.headerCard}>
        <Text style={styles.name}>{staff.name}</Text>
        <Text style={styles.email}>{staff.email}</Text>
        {staff.phone && <Text style={styles.phone}>{staff.phone}</Text>}
        <View style={styles.statusBadge}>
          <Text style={[styles.status, { color: staff.isActive ? Colors.success : Colors.danger }]}>
            {staff.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </Card>

      <View style={styles.actionsRow}>
        <Button title="Edit" variant="outline" size="sm" onPress={() => router.push(`/(owner)/staff/${id}/edit`)} style={styles.actionBtn} />
        <Button title="Reset Password" variant="outline" size="sm" onPress={() => setResetModalVisible(true)} style={styles.actionBtn} />
        <Button title="Delete" variant="danger" size="sm" onPress={handleDelete} style={styles.actionBtn} />
      </View>

      <Text style={styles.sectionTitle}>Permissions</Text>
      <Card style={styles.permissionsCard}>
        {Object.entries(grouped).map(([category, perms]) => (
          <View key={category} style={styles.category}>
            <Text style={styles.categoryTitle}>{category}</Text>
            {perms.map((perm) => {
              const granted = staff.permissions?.includes(perm.value);
              return (
                <View key={perm.value} style={styles.permissionRow}>
                  <Ionicons
                    name={granted ? 'checkmark-circle' : 'close-circle-outline'}
                    size={18}
                    color={granted ? Colors.success : Colors.textTertiary}
                  />
                  <Text style={[styles.permissionLabel, !granted && styles.permissionLabelMuted]}>{perm.label}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </Card>

      <ResetPasswordModal
        visible={resetModalVisible}
        onClose={() => setResetModalVisible(false)}
        onConfirm={(newPassword) => resetPasswordMutation.mutate(newPassword)}
        staffName={staff.name}
        loading={resetPasswordMutation.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  headerCard: { padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md },
  name: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  email: { fontSize: Typography.size.body, color: Colors.textSecondary, marginTop: Spacing.xs },
  phone: { fontSize: Typography.size.small, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { marginTop: Spacing.sm },
  status: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  actionBtn: { flex: 1 },
  sectionTitle: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  permissionsCard: { padding: Spacing.md },
  category: { marginBottom: Spacing.md },
  categoryTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  permissionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  permissionLabel: { fontSize: Typography.size.body, color: Colors.textPrimary },
  permissionLabelMuted: { color: Colors.textSecondary },
});
