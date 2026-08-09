import React from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useShopConfig } from '@/hooks/useShopConfig';
import { useShopConfigToggle } from '@/hooks/useShopConfigToggle';
import { SettingsCard, SettingsRow, SettingsSectionLabel } from '@/components/settings/SettingsRow';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

export default function InventorySettingsScreen() {
  const tabBarHeight = useTabBarHeight();

  const { shopConfig, loadingShop } = useShopConfig();
  const purchasingEnabled = shopConfig?.purchasingEnabled ?? false;
  const { toggling: togglingPurchasing, handleToggle: handleTogglePurchasing } = useShopConfigToggle(
    'purchasingEnabled',
    {
      on: 'Purchasing is on — record stock purchases from the Purchases tab',
      off: 'Purchasing is off and hidden from navigation',
    },
  );

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.lg }}>
        <SettingsSectionLabel label="How stock comes into your shop." />

        <Animated.View entering={FadeInUp.duration(320)}>
          <SettingsCard>
            <SettingsRow
              icon="cart-outline"
              title="Enable Purchasing Module"
              subtitle="Record stock purchases from suppliers and update inventory automatically"
              right={
                <Switch
                  value={purchasingEnabled}
                  onValueChange={handleTogglePurchasing}
                  disabled={togglingPurchasing || loadingShop}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={purchasingEnabled ? Colors.primary : Colors.textTertiary}
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
