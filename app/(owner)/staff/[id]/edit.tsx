import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, Switch } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getStaffById, updateStaff, updateStaffPermissions } from '@/services/staff';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useStaffDraftStore } from '@/store/staffDraftStore';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

export default function EditStaffScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const { permissions, setPermissions, reset } = useStaffDraftStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', isActive: true });
  const [seeded, setSeeded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => getStaffById(id),
  });

  useEffect(() => {
    if (data?.data && !seeded) {
      const staff = data.data;
      setForm({ name: staff.name, email: staff.email, phone: staff.phone || '', isActive: staff.isActive });
      setPermissions(staff.permissions || []);
      setSeeded(true);
    }
    return () => reset();
  }, [data]);

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
      Alert.alert('Error', error.response?.data?.message || 'Failed to update staff');
    },
  });

  const handleSave = () => {
    if (!form.name || !form.email) return Alert.alert('Error', 'Name and email are required');
    saveMutation.mutate();
  };

  if (isLoading || !seeded) {
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
          <Input label="Full Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
          <Input label="Email" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} autoCapitalize="none" keyboardType="email-address" />
          <Input label="Phone (optional)" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" />
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
              onValueChange={(v) => setForm({ ...form, isActive: v })}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCESS</Text>
          <TouchableOpacity style={styles.permissionsRow} onPress={() => router.push('/(owner)/staff/permissions')} activeOpacity={0.7}>
            <View style={styles.permissionsIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.permissionsText}>
              <Text style={styles.permissionsLabel}>Permissions</Text>
              <Text style={styles.permissionsCount}>{permissions.length} permission{permissions.length !== 1 ? 's' : ''} selected</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
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
