import React, { useState, useEffect } from 'react';
import { ScrollView, Alert, StyleSheet, View, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/context/AuthContext';
import { getShopConfig, updateShopConfig } from '@/services/shop';
import { changePassword } from '@/services/auth';
import { ShopSettingsForm } from '@/components/profile/ShopSettingsForm';
import { AccountInfo } from '@/components/profile/AccountInfo';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

export default function OwnerProfile() {
  const { user, logout } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [shop, setShop] = useState({ name: '', address: '', phone: '', email: '', taxRate: 0, currency: 'KES' });
  const [loadingShop, setLoadingShop] = useState(true);
  const [updatingShop, setUpdatingShop] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    loadShop();
  }, []);

  const loadShop = async () => {
    try {
      const res = await getShopConfig();
      if (res.success) setShop(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingShop(false);
    }
  };

  const handleShopUpdate = async () => {
    setUpdatingShop(true);
    try {
      await updateShopConfig(shop);
      Alert.alert('Success', 'Shop information updated');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Update failed');
    } finally {
      setUpdatingShop(false);
    }
  };

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

  if (loadingShop) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}>
        <ShopSettingsForm
          shop={shop}
          onChange={(field, value) => setShop({ ...shop, [field]: value })}
          onSave={handleShopUpdate}
          loading={updatingShop}
        />
        <AccountInfo name={user?.name || ''} email={user?.email || ''} role={user?.role || ''} />
        <ChangePasswordForm onChangePassword={handlePasswordChange} loading={updatingPassword} />
        <Button title="Logout" onPress={logout} variant="danger" style={styles.logoutButton} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoutButton: { marginTop: Spacing.md, marginBottom: Spacing.xl },
});
