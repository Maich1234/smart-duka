import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useAlert } from '@/context/AlertContext';
import { LoadingState } from '@/components/ui/LoadingState';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { getStaffById, getStaffCommission, deleteStaff, resetStaffPassword, updateStaff, getAllPermissions, type Permission } from '@/services/staff';
import { useStaffDeletionRequests } from '@/hooks/useStaffDeletionRequests';
import { getShopConfig } from '@/services/shop';
import { ResetPasswordModal } from '@/components/staff/ResetPasswordModal';
import { StaffDeletionRequestCard } from '@/components/staff/StaffDeletionRequestCard';
import { CommissionCard, getCommissionPeriodRange, type CommissionPeriod } from '@/components/sales/CommissionCard';
import { haptics } from '@/utils/haptics';
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
  const tabBarHeight = useTabBarHeight();
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [commissionPeriod, setCommissionPeriod] = useState<CommissionPeriod>('today');
  const { alert, toast } = useAlert();

  const { data, isLoading } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => getStaffById(id),
  });

  const { data: permissionsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: getAllPermissions,
  });

  // Shares its cache with the staff list's banner, so opening a request from
  // there costs nothing — and it carries the server's own grace/approval
  // windows, which the card must not hardcode.
  const { data: deletionRequestData } = useStaffDeletionRequests();
  const pendingClosure = deletionRequestData?.data.find((r) => r._id === id);

  const { data: shopData } = useQuery({ queryKey: ['shop'], queryFn: getShopConfig });
  const currency = shopData?.data?.currency ?? 'KES';

  const isOnCommission = data?.data?.commissionEligible === true;
  const { startDate, endDate } = getCommissionPeriodRange(commissionPeriod);
  const { data: commissionData, isLoading: isCommissionLoading } = useQuery({
    queryKey: ['staffCommission', id, commissionPeriod],
    queryFn: () => getStaffCommission(id, { startDate, endDate }),
    enabled: isOnCommission,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      router.back();
    },
    onError: (error: any) =>
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to delete staff' }),
  });

  // Optimistic so the switch responds instantly on a slow Kenyan connection;
  // rolled back if the write fails so the UI never lies about what was saved.
  const commissionMutation = useMutation({
    mutationFn: (enabled: boolean) => updateStaff(id, { commissionEligible: enabled }),
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ['staff', id] });
      const previous = queryClient.getQueryData<any>(['staff', id]);
      queryClient.setQueryData<any>(['staff', id], (old: any) =>
        old ? { ...old, data: { ...old.data, commissionEligible: enabled } } : old);
      return { previous };
    },
    onError: (error: any, _enabled, context) => {
      if (context?.previous) queryClient.setQueryData(['staff', id], context.previous);
      toast({ type: 'error', message: error.response?.data?.message || 'Could not update commission' });
    },
    onSuccess: (_res, enabled) => {
      toast({
        type: 'success',
        message: enabled ? 'Now earning commission' : 'No longer earning commission',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', id] });
      queryClient.invalidateQueries({ queryKey: ['staffCommission', id] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (newPassword: string) => resetStaffPassword(id, newPassword),
    onSuccess: () => {
      setResetModalVisible(false);
      toast({ type: 'success', message: 'Password reset successfully' });
    },
    onError: (error: any) =>
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to reset password' }),
  });

  const handleDelete = () => {
    alert({
      type: 'confirm',
      title: 'Remove Staff Member',
      message: `Are you sure you want to remove ${data?.data.name}? This cannot be undone.`,
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Remove', variant: 'danger', onPress: () => deleteMutation.mutate() },
      ],
    });
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

      {/* Account-closure request — the owner's decision, so it sits above
          everything else on the profile. */}
      {staff.deletionRequestedAt && !staff.deletionScheduledAt && (
        <View style={styles.closureSection}>
          <StaffDeletionRequestCard
            staffId={id}
            staffName={staff.name}
            requestedAt={staff.deletionRequestedAt}
            autoApprovesAt={pendingClosure?.autoApprovesAt}
            graceDays={deletionRequestData?.meta?.graceDays}
            /* The card already invalidates the ['staff'] prefix, which covers
               this screen's own ['staff', id] query. */
          />
        </View>
      )}

      {staff.deletionScheduledAt && (
        <View style={styles.closureSection}>
          <View style={styles.closureNote}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} />
            <Text style={styles.closureNoteText}>
              Closure approved — this account closes on {formatDate(staff.deletionScheduledAt)}.{' '}
              {staff.name} can still cancel before then.
            </Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <AnimatedPressable style={styles.actionBtn} onPress={() => router.push(`/(owner)/staff/${id}/edit`)}>
          <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          <Text style={styles.actionBtnText}>Edit</Text>
        </AnimatedPressable>
        <AnimatedPressable style={styles.actionBtn} onPress={() => setResetModalVisible(true)}>
          <Ionicons name="lock-closed-outline" size={16} color={Colors.primary} />
          <Text style={styles.actionBtnText}>Reset Password</Text>
        </AnimatedPressable>
        <AnimatedPressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Delete</Text>
        </AnimatedPressable>
      </View>

      {/* Sales & Commission */}
      <View style={styles.permissionsSection}>
        <Text style={styles.sectionTitle}>Sales & Commission</Text>
        <Text style={styles.sectionSubtitle}>
          Choose whether this person earns commission. Their earnings are always visible to you.
        </Text>
        <View style={styles.permissionsCard}>
          <View style={styles.commissionToggleRow}>
            <View style={styles.commissionToggleText}>
              <Text style={styles.commissionToggleTitle}>Earns commission</Text>
              <Text style={styles.commissionToggleSub}>
                Pays a share of anything sold above your floor price on products that have commission set up.
              </Text>
            </View>
            <Switch
              value={isOnCommission}
              onValueChange={(v) => { haptics.selection(); commissionMutation.mutate(v); }}
              disabled={commissionMutation.isPending}
              trackColor={{ false: Colors.border, true: Colors.primarySubtle }}
              thumbColor={isOnCommission ? Colors.primary : Colors.textTertiary}
              accessibilityLabel="Earns commission"
            />
          </View>

          {isOnCommission && (
            <View style={styles.categoryBlock}>
              <CommissionCard
                data={commissionData?.data}
                isLoading={isCommissionLoading}
                subject="staff"
                period={commissionPeriod}
                onPeriodChange={setCommissionPeriod}
                currency={currency}
              />
            </View>
          )}
        </View>
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

  closureSection: { marginBottom: Spacing.lg },
  closureNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  closureNoteText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.danger,
    lineHeight: 20,
  },
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
  commissionToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  commissionToggleText: { flex: 1 },
  commissionToggleTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  commissionToggleSub: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    marginTop: 2,
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
