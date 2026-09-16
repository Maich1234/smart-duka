import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Input } from '@/components/ui/Input';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useShopConfig } from '@/hooks/useShopConfig';
import { useAlert } from '@/context/AlertContext';
import { updateShopConfig } from '@/services/shop';
import { useQueryClient } from '@tanstack/react-query';
import { SettingsCard, SettingsRow, SettingsRowDivider, SettingsSectionLabel } from '@/components/settings/SettingsRow';
import { mutationErrorMessage } from '@/utils/errors';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const COLLECTION_PRESETS: { days: number; label: string }[] = [
  { days: 0, label: 'Same day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
];

/**
 * The shop's customer-credit rules.
 *
 * Every switch here writes through the same merge-not-replace endpoint
 * (updateShopConfig with a partial `creditSettings`), so flipping one setting
 * never resets the others — the pattern useShopConfigToggle already
 * established for every other shop flag.
 *
 * Turning credit off blocks new credit sales and nothing else: existing
 * debts, due dates and repayment history are untouched, and repayments keep
 * working. The copy says so explicitly, because "off" reads as "erased" if
 * it isn't told otherwise.
 */
export default function CreditSettingsScreen() {
  const tabBarHeight = useTabBarHeight();
  const { toast } = useAlert();
  const queryClient = useQueryClient();
  const { shopConfig, loadingShop } = useShopConfig();
  const settings = shopConfig?.creditSettings;

  const [savingEnabled, setSavingEnabled] = useState(false);
  // Only a local override while the owner is actively typing; the displayed
  // value otherwise reads straight off the fetched settings. Seeding this from
  // an effect left one render where the field was blank before the query
  // resolved — the exact case react-hooks/set-state-in-effect flags.
  const [limitDraft, setLimitDraft] = useState<string | null>(null);
  const [savingLimit, setSavingLimit] = useState(false);
  const [savingProductPolicy, setSavingProductPolicy] = useState(false);
  const [savingOverduePolicy, setSavingOverduePolicy] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const limitText = limitDraft ?? String(settings?.defaultCreditLimit ?? '');

  const patchCreditSettings = async (
    patch: Partial<NonNullable<typeof settings>>,
    setSaving: (v: boolean) => void,
    successMessage?: string,
  ) => {
    const previous = queryClient.getQueryData(['shopConfig']);
    queryClient.setQueryData(['shopConfig'], (old: any) =>
      old ? { ...old, data: { ...old.data, creditSettings: { ...old.data.creditSettings, ...patch } } } : old);
    setSaving(true);
    try {
      await updateShopConfig({ creditSettings: patch });
      queryClient.invalidateQueries({ queryKey: ['shopConfig'] });
      if (successMessage) toast({ type: 'success', message: successMessage });
    } catch (error) {
      queryClient.setQueryData(['shopConfig'], previous);
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not update credit settings') });
    } finally {
      setSaving(false);
    }
  };

  const handleEnabledToggle = (enabled: boolean) => {
    patchCreditSettings(
      { enabled },
      setSavingEnabled,
      enabled ? 'Customer credit is on' : 'Customer credit is off. Existing balances are unaffected.',
    );
  };

  const saveLimit = () => {
    const value = Number.parseFloat(limitText || '0');
    if (!Number.isFinite(value) || value < 0) {
      setLimitDraft(null); // snap back to the server value
      return;
    }
    patchCreditSettings({ defaultCreditLimit: value }, setSavingLimit, undefined);
    setLimitDraft(null); // the query cache is now the source of truth again
  };

  if (loadingShop || !settings) {
    return <View style={styles.flex} />;
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.lg }}>
        <SettingsSectionLabel label="Let staff sell on account and collect what customers owe." />

        <Animated.View entering={FadeInUp.duration(320)}>
          <SettingsCard>
            <SettingsRow
              icon="time-outline"
              iconColor={Colors.primary}
              iconBg={Colors.primarySubtle}
              title="Customer Credit"
              subtitle={settings.enabled ? 'Staff can sell on account' : 'Off — existing debts are unaffected'}
              right={
                <Switch
                  value={settings.enabled}
                  onValueChange={handleEnabledToggle}
                  disabled={savingEnabled}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={settings.enabled ? Colors.primary : Colors.textTertiary}
                />
              }
            />
          </SettingsCard>
        </Animated.View>

        {!settings.enabled && (
          <Animated.View entering={FadeInUp.duration(280)} style={styles.offNotice}>
            <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.offNoticeText}>
              New credit sales are blocked. Any existing balances, due dates and repayment history stay exactly
              as they are, and repayments still work.
            </Text>
          </Animated.View>
        )}

        <SettingsSectionLabel label="Default customer credit limit" />
        <Animated.View entering={FadeInUp.duration(320).delay(40)}>
          <SettingsCard>
            <Text style={styles.helperText}>
              What a customer may owe when they have no limit of their own. Set a bespoke limit for an
              individual on their account.
            </Text>
            <View style={styles.limitRow}>
              <Input
                value={limitText}
                onChangeText={(t) => setLimitDraft(t.replace(/[^0-9.]/g, ''))}
                onBlur={saveLimit}
                keyboardType="decimal-pad"
                placeholder="0.00"
                style={styles.limitInput}
                accessibilityLabel="Default credit limit"
              />
              {savingLimit && <Text style={styles.savingHint}>Saving…</Text>}
            </View>
          </SettingsCard>
        </Animated.View>

        <SettingsSectionLabel label="Collection period" />
        <Animated.View entering={FadeInUp.duration(320).delay(80)}>
          <SettingsCard>
            <Text style={styles.helperText}>
              How long a customer has to pay before a credit sale is overdue. Every sale keeps the term it was
              made under — changing this only affects new sales.
            </Text>
            <View style={styles.presetRow}>
              {COLLECTION_PRESETS.map((preset) => {
                const selected = settings.defaultCollectionPeriodDays === preset.days;
                return (
                  <AnimatedPressable
                    key={preset.days}
                    onPress={() => patchCreditSettings({ defaultCollectionPeriodDays: preset.days }, setSavingPeriod)}
                    style={[styles.preset, selected && styles.presetSelected]}
                    disabled={savingPeriod}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.presetLabel, selected && styles.presetLabelSelected]}>{preset.label}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </SettingsCard>
        </Animated.View>

        <SettingsSectionLabel label="Which products can be sold on credit" />
        <Animated.View entering={FadeInUp.duration(320).delay(120)}>
          <SettingsCard>
            <SettingsRow
              icon="apps-outline"
              title="All products"
              subtitle="Every product may be sold on credit"
              right={settings.productPolicy === 'ALL_PRODUCTS' ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} /> : undefined}
              onPress={() => { if (!savingProductPolicy) patchCreditSettings({ productPolicy: 'ALL_PRODUCTS' }, setSavingProductPolicy); }}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="checkbox-outline"
              title="Selected products only"
              subtitle="Choose which products in Inventory allow credit"
              right={settings.productPolicy === 'SELECTED_PRODUCTS' ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} /> : undefined}
              onPress={() => { if (!savingProductPolicy) patchCreditSettings({ productPolicy: 'SELECTED_PRODUCTS' }, setSavingProductPolicy); }}
            />
          </SettingsCard>
        </Animated.View>
        {settings.productPolicy === 'SELECTED_PRODUCTS' && (
          <Animated.View entering={FadeInUp.duration(280)} style={styles.offNotice}>
            <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.offNoticeText}>
              No product is credit-eligible until you turn it on for that product in Inventory. A credit sale
              is refused if it contains anything that isn&rsquo;t.
            </Text>
          </Animated.View>
        )}

        <SettingsSectionLabel label="When a customer is overdue" />
        <Animated.View entering={FadeInUp.duration(320).delay(160)}>
          <SettingsCard>
            <SettingsRow
              icon="lock-closed-outline"
              iconColor={Colors.danger}
              iconBg={Colors.dangerSubtle}
              title="Block new credit"
              subtitle="No more credit sales until they pay something"
              right={settings.overduePolicy === 'BLOCK' ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} /> : undefined}
              onPress={() => { if (!savingOverduePolicy) patchCreditSettings({ overduePolicy: 'BLOCK' }, setSavingOverduePolicy); }}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="lock-open-outline"
              title="Allow within their limit"
              subtitle="They can keep buying on credit if they're under their limit"
              right={settings.overduePolicy === 'ALLOW' ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} /> : undefined}
              onPress={() => { if (!savingOverduePolicy) patchCreditSettings({ overduePolicy: 'ALLOW' }, setSavingOverduePolicy); }}
            />
          </SettingsCard>
        </Animated.View>

        <AnimatedPressable
          onPress={() => router.push('/(owner)/credit/opening-balances' as never)}
          style={styles.importRow}
          accessibilityRole="button"
        >
          <Ionicons name="archive-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.importRowText}>Bring forward a debt from before credit tracking</Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
        </AnimatedPressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  offNotice: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.divider,
  },
  offNoticeText: { flex: 1, fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  helperText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, marginBottom: Spacing.sm },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  limitInput: { flex: 1 },
  savingHint: { fontSize: 11, color: Colors.textTertiary },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  preset: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minHeight: 40,
    justifyContent: 'center',
  },
  presetSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  presetLabel: { fontSize: 13, color: Colors.textSecondary, fontFamily: Typography.fontFamilySemiBold },
  presetLabelSelected: { color: Colors.white },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: 10,
  },
  importRowText: { flex: 1, fontSize: 12, color: Colors.textSecondary },
});
