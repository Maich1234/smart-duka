import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useAlert } from '@/context/AlertContext';
import {
  getNotificationsPreference,
  setNotificationsPreference,
  registerDeviceForNotifications,
  unregisterDeviceFromNotifications,
} from '@/services/notifications';
import { SettingsCard, SettingsRow, SettingsSectionLabel } from '@/components/settings/SettingsRow';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

/** Push notification preference — distinct from /(owner)/notifications, which is the inbox itself. */
export default function NotificationSettingsScreen() {
  const tabBarHeight = useTabBarHeight();
  const { toast } = useAlert();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  // Register/unregister are both real network round-trips (see
  // services/notifications.ts) — a second tap before the first resolves can
  // let an in-flight unregister land after a later register (or vice versa),
  // leaving the device's actual push-subscription state disagreeing with
  // what the switch shows. Blocking input while one is outstanding is
  // simpler and safer than trying to serialize or cancel them.
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    getNotificationsPreference().then((v) => {
      setEnabled(v);
      setLoading(false);
    });
  }, []);

  const handleToggle = async (value: boolean) => {
    setEnabled(value);
    setToggling(true);
    try {
      await setNotificationsPreference(value);
      if (value) await registerDeviceForNotifications();
      else await unregisterDeviceFromNotifications();
    } catch (error: any) {
      // register/unregisterDeviceForNotifications already swallow their own
      // errors (best-effort by design), so this only ever catches a failed
      // AsyncStorage write — rare, but the switch must not keep showing a
      // preference that was never actually saved.
      setEnabled(!value);
      toast({ type: 'error', message: error?.message || 'Could not update the setting' });
    } finally {
      setToggling(false);
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.lg }}>
        <SettingsSectionLabel label="Control what this device gets notified about." />
        <Animated.View entering={FadeInUp.duration(320)}>
          <SettingsCard>
            <SettingsRow
              icon="notifications-outline"
              iconColor="#B45309"
              iconBg="#FEF3C7"
              title="Push Notifications"
              subtitle="Low stock alerts & sales anomalies"
              right={
                <Switch
                  value={enabled}
                  onValueChange={handleToggle}
                  disabled={loading || toggling}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={enabled ? Colors.primary : Colors.textTertiary}
                />
              }
            />
          </SettingsCard>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
});
