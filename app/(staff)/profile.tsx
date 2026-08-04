import React, { useState } from 'react';
import { ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAlert } from '@/context/AlertContext';
import { LoadingState } from '@/components/ui/LoadingState';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useAuth } from '@/context/AuthContext';
import { changePassword } from '@/services/auth';
import { AccountInfo } from '@/components/profile/AccountInfo';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { DeleteAccountSection } from '@/components/profile/DeleteAccountSection';
import { LegalSection } from '@/components/profile/LegalSection';
import { PrinterSection } from '@/components/profile/PrinterSection';
import { Button } from '@/components/ui/Button';
import { openHelp } from '@/utils/openHelp';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

export default function StaffProfile() {
  const { user, logout } = useAuth();
  const tabBarHeight = useTabBarHeight();
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const { toast, alert } = useAlert();

  // Signing out mid-shift loses an in-progress sale and, with one-device
  // sessions, means asking the owner for help if the password isn't to hand —
  // too costly to trigger from a mistap right under the legal links.
  const handleLogout = () => {
    alert({
      type: 'confirm',
      title: 'Sign out?',
      message: 'You\'ll need to sign back in to keep selling.',
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Sign out', variant: 'danger', onPress: logout },
      ],
    });
  };

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
        <PrinterSection href="/(staff)/printer" />
        <ChangePasswordForm onChangePassword={handlePasswordChange} loading={updatingPassword} />
        <LegalSection />
        <Button title="Logout" onPress={handleLogout} variant="danger" style={styles.logoutButton} />
        <DeleteAccountSection />
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
