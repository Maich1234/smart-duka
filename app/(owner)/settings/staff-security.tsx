import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useAlert } from '@/context/AlertContext';
import { useShopConfig } from '@/hooks/useShopConfig';
import { useShopConfigToggle } from '@/hooks/useShopConfigToggle';
import { changePassword } from '@/services/auth';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { SettingsCard, SettingsRow, SettingsRowDivider, SettingsSectionLabel } from '@/components/settings/SettingsRow';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

export default function StaffSecuritySettingsScreen() {
  const tabBarHeight = useTabBarHeight();
  const { toast } = useAlert();

  const { shopConfig, loadingShop } = useShopConfig();
  const showStaffCommission = shopConfig?.showStaffCommission ?? false;
  const { toggling: togglingCommissionVisibility, handleToggle: handleToggleStaffCommission } = useShopConfigToggle(
    'showStaffCommission',
    {
      on: 'Staff can now preview and track their commission',
      off: 'Commission is now hidden from staff',
    },
  );
  const [updatingPassword, setUpdatingPassword] = useState(false);

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

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.lg }}>
        <SettingsSectionLabel label="Staff access, pay visibility, and your own login." />

        <Animated.View entering={FadeInUp.duration(320)}>
          <SettingsCard>
            <SettingsRow
              icon="people-outline"
              title="Manage Staff"
              subtitle="Add, edit, or remove staff accounts"
              onPress={() => router.push('/(owner)/staff')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="cash-outline"
              title="Show Commission to Staff"
              subtitle="Let staff preview and track their earned commission"
              right={
                <Switch
                  value={showStaffCommission}
                  onValueChange={handleToggleStaffCommission}
                  disabled={togglingCommissionVisibility || loadingShop}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={showStaffCommission ? Colors.primary : Colors.textTertiary}
                />
              }
            />
          </SettingsCard>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(320).delay(60)} style={styles.wrap}>
          <ChangePasswordForm onChangePassword={handlePasswordChange} loading={updatingPassword} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  wrap: { marginHorizontal: Spacing.lg, marginTop: 22 },
});
