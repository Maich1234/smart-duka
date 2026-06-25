import React, { useState } from 'react';
import { ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAlert } from '@/context/AlertContext';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/context/AuthContext';
import { changePassword } from '@/services/auth';
import { AccountInfo } from '@/components/profile/AccountInfo';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { Button } from '@/components/ui/Button';
import { openHelp } from '@/utils/openHelp';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

export default function StaffProfile() {
  const { user, logout } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const { toast } = useAlert();

  const handlePasswordChange = async (current: string, newPwd: string) => {
    setUpdatingPassword(true);
    try {
      await changePassword(current, newPwd);
      toast({ type: 'success', message: 'Password changed successfully' });
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Password change failed' });
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (!user) {
    return <LoadingState />;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}>
        <Button
          title="Help & Learning Center"
          variant="outline"
          onPress={() => openHelp()}
          style={styles.helpButton}
        />
        <AccountInfo name={user.name} email={user.email} role={user.role} />
        <ChangePasswordForm onChangePassword={handlePasswordChange} loading={updatingPassword} />
        <Button title="Logout" onPress={logout} variant="danger" style={styles.logoutButton} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  helpButton: { marginBottom: Spacing.md },
  logoutButton: { marginTop: Spacing.md, marginBottom: Spacing.xl },
});
