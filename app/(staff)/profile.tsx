import React, { useState } from 'react';
import { ScrollView, Alert, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { changePassword } from '@/services/auth';
import { AccountInfo } from '@/components/profile/AccountInfo';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

export default function StaffProfile() {
  const { user, logout } = useAuth();
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handlePasswordChange = async (current: string, newPwd: string) => {
    setUpdatingPassword(true);
    try {
      await changePassword(current, newPwd);
      Alert.alert('Success', 'Password changed successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Password change failed');
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <AccountInfo name={user.name} email={user.email} role={user.role} />
      <ChangePasswordForm onChangePassword={handlePasswordChange} loading={updatingPassword} />
      <Button title="Logout" onPress={logout} variant="danger" style={styles.logoutButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoutButton: { marginTop: Spacing.md, marginBottom: Spacing.xl },
});
