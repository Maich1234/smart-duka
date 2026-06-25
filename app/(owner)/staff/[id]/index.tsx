import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getStaffById, deleteStaff, resetStaffPassword, getAllPermissions, type Permission } from '@/services/staff';
import { Button } from '@/components/ui/Button';
import { ResetPasswordModal } from '@/components/staff/ResetPasswordModal';
import { deriveRole } from '@/components/staff/StaffCard';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const AVATAR_PALETTE = [
  { bg: Colors.primarySubtle, text: Colors.primary },
  { bg: Colors.accentSubtle, text: Colors.accentDark },
  { bg: '#EDE9FE', text: '#6D28D9' },
  { bg: '#DBEAFE', text: '#1D4ED8' },
  { bg: '#FCE7F3', text: '#9D174D' },
];

function avatarColors(name: string) {
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

function initials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

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
    Alert.alert('Remove Staff Member', `Are you sure you want to remove ${data?.data.name}? This cannot be undone.`, [
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

  const avatarColor = avatarColors(staff.name);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]}
    >
      {/* Profile header */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
          <Text style={[styles.avatarText, { color: avatarColor.text }]}>{initials(staff.name)}</Text>
        </View>
        <Text style={styles.name}>{staff.name}</Text>
        <Text style={styles.email}>{staff.email}</Text>
        <View style={[styles.statusBadge, staff.isActive ? styles.statusActive : styles.statusInactive]}>
          <Text style={[styles.statusText, staff.isActive ? styles.statusTextActive : styles.statusTextInactive]}>
            {staff.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/(owner)/staff/${id}/edit`)} activeOpacity={0.7}>
          <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          <Text style={styles.actionBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setResetModalVisible(true)} activeOpacity={0.7}>
          <Ionicons name="lock-closed-outline" size={16} color={Colors.primary} />
          <Text style={styles.actionBtnText}>Reset Password</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Permissions */}
      <View style={styles.permissionsSection}>
        <Text style={styles.sectionTitle}>Permissions</Text>
        <Text style={styles.sectionSubtitle}>Control what this staff member can access and manage.</Text>

        <View style={styles.permissionsCard}>
          {Object.entries(grouped).map(([category, perms], groupIndex) => (
            <View key={category} style={[styles.categoryBlock, groupIndex > 0 && styles.categoryBlockBorder]}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {perms.map((perm) => {
                const granted = staff.permissions?.includes(perm.value);
                return (
                  <View key={perm.value} style={styles.permissionRow}>
                    <Ionicons
                      name={granted ? 'checkmark-circle' : 'close-circle-outline'}
                      size={20}
                      color={granted ? Colors.success : Colors.textTertiary}
                    />
                    <Text style={[styles.permissionLabel, !granted && styles.permissionLabelMuted]}>
                      {perm.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Footer info */}
      <View style={styles.footer}>
        <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
        <Text style={styles.footerText}>
          Joined on {formatDate(staff.createdAt)}{'  '}•{'  '}Last active {timeAgo(staff.updatedAt)}
        </Text>
      </View>

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
  content: { padding: Spacing.md },

  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
  },
  name: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusActive: { backgroundColor: Colors.successSubtle },
  statusInactive: { backgroundColor: Colors.dangerSubtle },
  statusText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  statusTextActive: { color: Colors.success },
  statusTextInactive: { color: Colors.danger },

  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
  },
  actionBtnDanger: {
    borderColor: Colors.dangerSubtle,
    backgroundColor: Colors.dangerSubtle,
  },
  actionBtnText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },

  permissionsSection: { marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  permissionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  categoryBlock: {
    padding: Spacing.md,
  },
  categoryBlockBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  categoryTitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 7,
  },
  permissionLabel: {
    fontSize: Typography.size.body,
    color: Colors.textPrimary,
  },
  permissionLabelMuted: {
    color: Colors.textSecondary,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  footerText: {
    fontSize: Typography.size.small,
    color: Colors.textTertiary,
  },
});
