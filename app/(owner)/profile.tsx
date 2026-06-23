import React, { useState, useEffect } from 'react';
import { ScrollView, Alert, StyleSheet, View, KeyboardAvoidingView, Platform, Text, Switch } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/context/AuthContext';
import { getShopConfig, updateShopConfig } from '@/services/shop';
import { changePassword } from '@/services/auth';
import {
  getNotificationsPreference,
  setNotificationsPreference,
  registerDeviceForNotifications,
  unregisterDeviceFromNotifications,
} from '@/services/notifications';
import { ShopSettingsForm } from '@/components/profile/ShopSettingsForm';
import { AccountInfo } from '@/components/profile/AccountInfo';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function OwnerProfile() {
  const { user, logout } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [shop, setShop] = useState({ name: '', address: '', phone: '', email: '', taxRate: 0, currency: 'KES', receiptThankYouNote: '' });
  const [loadingShop, setLoadingShop] = useState(true);
  const [updatingShop, setUpdatingShop] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    loadShop();
    getNotificationsPreference().then(setNotificationsEnabled);
  }, []);

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    await setNotificationsPreference(enabled);
    if (enabled) {
      await registerDeviceForNotifications();
    } else {
      await unregisterDeviceFromNotifications();
    }
  };

  const loadShop = async () => {
    try {
      const res = await getShopConfig();
      if (res.success) setShop({ ...res.data, receiptThankYouNote: res.data.receiptThankYouNote ?? '' });
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingShop(false);
    }
  };

  const handleShopUpdate = async () => {
    setUpdatingShop(true);
    try {
      const { name, address, phone, email, taxRate, currency, receiptThankYouNote } = shop;
      await updateShopConfig({ name, address, phone, email, taxRate, currency, receiptThankYouNote });
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
    return <LoadingState />;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
      >
        <Button
          title="Help & Learning Center"
          variant="outline"
          onPress={() => router.push('/(help)')}
          style={styles.helpButton}
        />

        <ShopSettingsForm
          shop={shop}
          onChange={(field, value) => setShop({ ...shop, [field]: value })}
          onSave={handleShopUpdate}
          loading={updatingShop}
        />
        <AccountInfo name={user?.name || ''} email={user?.email || ''} role={user?.role || ''} />

        <Card style={styles.notificationsCard}>
          <View style={styles.notificationsRow}>
            <View style={styles.notificationsInfo}>
              <Text style={styles.notificationsTitle}>Push Notifications</Text>
              <Text style={styles.notificationsSubtitle}>Sales anomalies & low-stock alerts</Text>
            </View>
            <Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} />
          </View>
        </Card>

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

  notificationsCard: { marginBottom: Spacing.md },
  notificationsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notificationsInfo: { flex: 1, marginRight: Spacing.md },
  notificationsTitle: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  notificationsSubtitle: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
});
