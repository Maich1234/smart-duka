import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { SettingsCard, SettingsRow, SettingsRowDivider, SettingsSectionLabel } from '@/components/settings/SettingsRow';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

/** Pure navigation hub — each destination already owns its own data and logic. */
export default function DataReportsSettingsScreen() {
  const tabBarHeight = useTabBarHeight();

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.lg }}>
        <SettingsSectionLabel label="Reports, records, and reconciliation." />

        <Animated.View entering={FadeInUp.duration(320)}>
          <SettingsCard>
            <SettingsRow
              icon="bar-chart-outline"
              title="Reports"
              subtitle="Sales, inventory & staff performance"
              onPress={() => router.push('/(owner)/reports')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="book-outline"
              title="Business Books"
              subtitle="Financial records for tax and accounting"
              onPress={() => router.push('/(owner)/books')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="today-outline"
              title="Daily Summary"
              subtitle="Yesterday and today at a glance"
              onPress={() => router.push('/(owner)/summary')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="checkmark-done-outline"
              title="Reconciliation"
              subtitle="Cashier shifts and month-end reconciliation"
              onPress={() => router.push('/(owner)/reconciliation')}
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
