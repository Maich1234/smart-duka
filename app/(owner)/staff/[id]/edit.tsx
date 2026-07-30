import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useAlert } from '@/context/AlertContext';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { getStaffById, updateStaff, updateStaffPermissions } from '@/services/staff';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useStaffDraftStore } from '@/store/staffDraftStore';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface StaffForm {
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
}

export default function EditStaffScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const { permissions, setPermissions, reset } = useStaffDraftStore();
  // Only the owner's edits are state; the rest is read straight off the server
  // response. Seeding local state from a fetch in an effect meant one render
  // where the data had arrived but the fields were still blank — the cascading
  // render react-hooks/set-state-in-effect exists to catch.
  const [edits, setEdits] = useState<Partial<StaffForm>>({});
  const { toast } = useAlert();

  const { data, isLoading } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => getStaffById(id),
  });
  const staff = data?.data;

  const form: StaffForm = {
    name: edits.name ?? staff?.name ?? '',
    email: edits.email ?? staff?.email ?? '',
    phone: edits.phone ?? staff?.phone ?? '',
    // ?? not ||, so toggling this off isn't overwritten by the server value.
    isActive: edits.isActive ?? staff?.isActive ?? true,
  };
  const updateForm = (patch: Partial<StaffForm>) => setEdits((e) => ({ ...e, ...patch }));

  // Permissions live in the shared draft store, so this one really is an
  // external-store sync rather than local state catching up. Guarded by id so
  // it seeds once per staff member, not on every refetch.
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (staff && seededFor.current !== staff._id) {
      seededFor.current = staff._id;
      setPermissions(staff.permissions || []);
    }
  }, [staff, setPermissions]);

  // Cleared on the way out so the next staff member doesn't inherit these.
  useEffect(() => reset, [reset]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateStaff(id, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        isActive: form.isActive,
      });
      await updateStaffPermissions(id, permissions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      router.back();
    },
    onError: (error: any) => {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to update staff' });
    },
  });

  const handleSave = () => {
    if (!form.name || !form.email) {
      return toast({ type: 'error', message: 'Name and email are required' });
    }
    saveMutation.mutate();
  };

  if (isLoading || !staff) {
    return <LoadingState />;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BASIC INFORMATION</Text>
          <Input label="Full Name" value={form.name} onChangeText={(t) => updateForm({ name: t })} />
          <Input label="Email" value={form.email} onChangeText={(t) => updateForm({ email: t })} autoCapitalize="none" keyboardType="email-address" />
          <Input label="Phone (optional)" value={form.phone} onChangeText={(t) => updateForm({ phone: t })} keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STATUS</Text>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.statusRowLabel}>Active</Text>
              <Text style={styles.statusRowSubtitle}>
                {form.isActive ? 'Staff member can log in' : 'Staff member is blocked from logging in'}
              </Text>
            </View>
            <Switch
              value={form.isActive}
              onValueChange={(v) => updateForm({ isActive: v })}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCESS</Text>
          <AnimatedPressable style={styles.permissionsRow} onPress={() => router.push('/(owner)/staff/permissions')}>
            <View style={styles.permissionsIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.permissionsText}>
              <Text style={styles.permissionsLabel}>Permissions</Text>
              <Text style={styles.permissionsCount}>{permissions.length} permission{permissions.length !== 1 ? 's' : ''} selected</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </AnimatedPressable>
        </View>

        <Button title="Save Changes" onPress={handleSave} loading={saveMutation.isPending} style={styles.button} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  statusRowLabel: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  statusRowSubtitle: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  permissionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  permissionsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionsText: { flex: 1 },
  permissionsLabel: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  permissionsCount: { fontSize: Typography.size.small, color: Colors.textSecondary, marginTop: 2 },
  button: { marginTop: Spacing.sm },
});
