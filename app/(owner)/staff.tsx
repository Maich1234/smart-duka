import React, { useState } from 'react';
import { View, FlatList, RefreshControl, Alert, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStaff, createStaff, updateStaff, deleteStaff,
  resetStaffPassword, getAllPermissions, updateStaffPermissions,
} from '@/services/staff';
import { StaffCard } from '@/components/staff/StaffCard';
import { StaffFormModal } from '@/components/staff/StaffFormModal';
import { ResetPasswordModal } from '@/components/staff/ResetPasswordModal';
import { PermissionsModal } from '@/components/staff/PermissionsModal';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function OwnerStaff() {
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [permissionsModalVisible, setPermissionsModalVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [tempPermissions, setTempPermissions] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staff', search],
    queryFn: () => getStaff({ search }),
  });

  const { data: permissionsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: getAllPermissions,
  });

  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); closeModal(); },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to add staff'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateStaff(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); closeModal(); },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to update staff'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to delete staff'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetStaffPassword(id, password),
    onSuccess: () => { setResetModalVisible(false); Alert.alert('Success', 'Password reset'); },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to reset password'),
  });

  const permissionsMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) => updateStaffPermissions(id, permissions),
    onSuccess: () => {
      setPermissionsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to update permissions'),
  });

  const openModal = (staff?: any) => {
    if (staff) {
      setEditingStaff(staff);
      setForm({ name: staff.name, email: staff.email, password: '', phone: staff.phone || '' });
    } else {
      setEditingStaff(null);
      setForm({ name: '', email: '', password: '', phone: '' });
    }
    setModalVisible(true);
  };

  const closeModal = () => setModalVisible(false);

  const handleSave = () => {
    if (!form.name || !form.email) return Alert.alert('Error', 'Name and email required');
    if (!editingStaff && !form.password) return Alert.alert('Error', 'Password required');
    const payload = { name: form.name, email: form.email, phone: form.phone };
    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff._id, data: payload });
    } else {
      createMutation.mutate({ ...payload, password: form.password });
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Confirm', 'Delete staff member?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const handleResetPassword = (staff: any) => {
    setSelectedStaff(staff);
    setResetModalVisible(true);
  };

  const handlePermissions = (staff: any) => {
    setSelectedStaff(staff);
    setTempPermissions(staff.permissions || []);
    setPermissionsModalVisible(true);
  };

  const togglePermission = (permValue: string) => {
    setTempPermissions((prev) =>
      prev.includes(permValue) ? prev.filter((p) => p !== permValue) : [...prev, permValue]
    );
  };

  const savePermissions = () => {
    if (selectedStaff) {
      permissionsMutation.mutate({ id: selectedStaff._id, permissions: tempPermissions });
    }
  };

  const staffList = data?.data || [];
  const allPermissions = permissionsData?.data || [];

  if (isLoading && staffList.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Staff</Text>
        <Button title="Add Staff" onPress={() => openModal()} size="sm" />
      </View>
      <SearchBar value={search} onChangeText={setSearch} />
      <FlatList
        data={staffList}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <StaffCard
            staff={item}
            onEdit={() => openModal(item)}
            onResetPassword={() => handleResetPassword(item)}
            onPermissions={() => handlePermissions(item)}
            onDelete={() => handleDelete(item._id)}
          />
        )}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>No staff found</Text>
          </View>
        }
      />

      <StaffFormModal
        visible={modalVisible}
        onClose={closeModal}
        onSave={handleSave}
        form={form}
        setForm={setForm}
        isEditing={!!editingStaff}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <ResetPasswordModal
        visible={resetModalVisible}
        onClose={() => setResetModalVisible(false)}
        onConfirm={(newPassword) => {
          if (selectedStaff) resetPasswordMutation.mutate({ id: selectedStaff._id, password: newPassword });
        }}
        staffName={selectedStaff?.name || ''}
        loading={resetPasswordMutation.isPending}
      />

      <PermissionsModal
        visible={permissionsModalVisible}
        onClose={() => setPermissionsModalVisible(false)}
        onSave={savePermissions}
        permissions={allPermissions}
        selectedPermissions={tempPermissions}
        onTogglePermission={togglePermission}
        staffName={selectedStaff?.name || ''}
        loading={permissionsMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  empty: { textAlign: 'center', marginTop: Spacing.xl, color: Colors.textSecondary },
});
