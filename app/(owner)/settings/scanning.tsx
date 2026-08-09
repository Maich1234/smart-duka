import React from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useShopConfig } from '@/hooks/useShopConfig';
import { useShopConfigToggle } from '@/hooks/useShopConfigToggle';
import { useScanFeedbackStore } from '@/store/scanFeedbackStore';
import { SettingsCard, SettingsRow, SettingsRowDivider, SettingsSectionLabel } from '@/components/settings/SettingsRow';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

export default function ScanningSettingsScreen() {
  const tabBarHeight = useTabBarHeight();

  const { shopConfig, loadingShop } = useShopConfig();
  // Defaults on, unlike most flags here — scanning has to work with zero
  // setup, so a shop that never touched this still sees it enabled.
  const barcodeScanningEnabled = shopConfig?.barcodeScanningEnabled ?? true;
  const { toggling: togglingBarcodeScanning, handleToggle: handleToggleBarcodeScanning } = useShopConfigToggle(
    'barcodeScanningEnabled',
    { on: 'Barcode scanning is on', off: 'Barcode scanning is off and hidden from the till' },
  );

  // Device-local — this phone's beep/buzz, not shop policy. See
  // store/scanFeedbackStore.ts for why (same reasoning as the printer choice).
  const soundEnabled = useScanFeedbackStore((s) => s.soundEnabled);
  const vibrationEnabled = useScanFeedbackStore((s) => s.vibrationEnabled);
  const setSoundEnabled = useScanFeedbackStore((s) => s.setSoundEnabled);
  const setVibrationEnabled = useScanFeedbackStore((s) => s.setVibrationEnabled);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.lg }}>
        <SettingsSectionLabel label="Barcode scanning at the till." />

        <Animated.View entering={FadeInUp.duration(320)}>
          <SettingsCard>
            <SettingsRow
              icon="scan-outline"
              title="Barcode Scanning"
              subtitle="Let cashiers scan products to add them to a sale"
              right={
                <Switch
                  value={barcodeScanningEnabled}
                  onValueChange={handleToggleBarcodeScanning}
                  disabled={togglingBarcodeScanning || loadingShop}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={barcodeScanningEnabled ? Colors.primary : Colors.textTertiary}
                />
              }
            />
          </SettingsCard>
        </Animated.View>

        <SettingsSectionLabel label="Scan feedback — this device only." />
        <Animated.View entering={FadeInUp.duration(320).delay(60)}>
          <SettingsCard>
            <SettingsRow
              icon="volume-high-outline"
              title="Scan Sound"
              subtitle="Beep when a barcode is recognized"
              right={
                <Switch
                  value={soundEnabled}
                  onValueChange={setSoundEnabled}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={soundEnabled ? Colors.primary : Colors.textTertiary}
                />
              }
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="phone-portrait-outline"
              title="Vibration"
              subtitle="Haptic feedback when a barcode is recognized"
              right={
                <Switch
                  value={vibrationEnabled}
                  onValueChange={setVibrationEnabled}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={vibrationEnabled ? Colors.primary : Colors.textTertiary}
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
