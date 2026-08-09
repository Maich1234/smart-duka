import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useShopConfig } from '@/hooks/useShopConfig';
import { useShopConfigToggle } from '@/hooks/useShopConfigToggle';
import { usePrinterStore } from '@/store/printerStore';
import { resolveSaleMethods } from '@/constants/paymentMethods';
import { SettingsCard, SettingsRow, SettingsRowDivider, SettingsSectionLabel } from '@/components/settings/SettingsRow';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

export default function PosSalesSettingsScreen() {
  const tabBarHeight = useTabBarHeight();
  const savedPrinter = usePrinterStore((s) => s.printer);

  const { shopConfig, loadingShop } = useShopConfig();
  const shiftManagementEnabled = shopConfig?.shiftManagementEnabled ?? false;
  const { toggling: togglingShifts, handleToggle: handleToggleShiftManagement } = useShopConfigToggle(
    'shiftManagementEnabled',
    {
      on: 'Shift management is on — staff clock in before selling',
      off: 'Shift management is off',
    },
    [['activeShift']],
  );

  const paymentMethodsSummary = useMemo(() => {
    const active = resolveSaleMethods(shopConfig?.paymentMethods);
    if (active.length <= 3) return active.map((m) => m.label).join(' · ');
    return `${active.slice(0, 2).map((m) => m.label).join(' · ')} + ${active.length - 2} more`;
  }, [shopConfig]);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.lg }}>
        <SettingsSectionLabel label="How the till takes payment and runs a shift." />

        <Animated.View entering={FadeInUp.duration(320)}>
          <SettingsCard>
            <SettingsRow
              icon="wallet-outline"
              title="Payment Methods"
              subtitle={paymentMethodsSummary}
              onPress={() => router.push('/(owner)/payment-methods')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="print-outline"
              title="Receipt Printer"
              subtitle={
                savedPrinter
                  ? `${savedPrinter.name} · ${savedPrinter.paperWidth}mm`
                  : 'Print straight to a Bluetooth thermal printer'
              }
              onPress={() => router.push('/(owner)/printer')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="time-outline"
              iconColor="#B91C1C"
              iconBg="#FEE2E2"
              title="Shift Management"
              subtitle="Staff clock in & reconcile the till; daily summary at close"
              right={
                <Switch
                  value={shiftManagementEnabled}
                  onValueChange={handleToggleShiftManagement}
                  disabled={togglingShifts || loadingShop}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={shiftManagementEnabled ? Colors.primary : Colors.textTertiary}
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
