import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createStaff, updateStaffPermissions } from '@/services/staff';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useStaffDraftStore } from '@/store/staffDraftStore';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const DEFAULT_STAFF_PERMISSIONS = ['view_products', 'record_sale', 'view_sales'];

export default function NewStaffScreen() {
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const { permissions, setPermissions, reset } = useStaffDraftStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  useEffect(() => {
    setPermissions(DEFAULT_STAFF_PERMISSIONS);
    return () => reset();
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const created = await createStaff({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
      });
      const staffId = created.data._id;
      await updateStaffPermissions(staffId, permissions);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      router.back();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Failed to add staff');
    },
  });

  const handleSave = () => {
    if (!form.name || !form.email) return Alert.alert('Error', 'Name and email are required');
    if (!form.password || form.password.length < 6) {
      return Alert.alert('Error', 'Password must be at least 6 characters');
    }
    saveMutation.mutate();
  };

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
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <Input label="Password" value={form.password} onChangeText={(t) => setForm({ ...form, password: t })} secureTextEntry />
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

        <Button title="Add Staff Member" onPress={handleSave} loading={saveMutation.isPending} style={styles.button} />
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
