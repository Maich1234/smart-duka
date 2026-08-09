import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInUp, LinearTransition } from 'react-native-reanimated';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useAlert } from '@/context/AlertContext';
import { getShopConfig, updateShopConfig } from '@/services/shop';
import { getPaymentStatus } from '@/services/paymentConfig';
import { PaymentsSection } from './PaymentsSection';
import {
  CASH_METHOD_KEY,
  DEFAULT_SALE_METHODS,
  MPESA_METHOD_KEY,
  SUGGESTED_SALE_METHODS,
  methodIcon,
  slugifyMethodKey,
  type ShopPaymentMethod,
} from '@/constants/paymentMethods';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { haptics } from '@/utils/haptics';

const MAX_METHODS = 12;

/**
 * Owner-managed till buttons.
 *
 * The till used to offer exactly Cash and M-Pesa, and M-Pesa only worked once
 * Daraja credentials were saved. That fitted almost nobody: shops take money on
 * Pochi la Biashara, on a personal number, on Airtel, into a bank account. This
 * screen lets the shop describe how it actually gets paid; every button records
 * a sale and prints a receipt, and M-Pesa additionally offers an STK prompt if
 * (and only if) the shop has connected M-Pesa Business.
 */
export const PaymentMethodsScreen: React.FC = () => {
  const tabBarHeight = useTabBarHeight();
  const { toast, alert } = useAlert();
  const queryClient = useQueryClient();

  const { data: shopConfig, isLoading } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });
  const { data: paymentStatus } = useQuery({
    queryKey: ['paymentStatus'],
    queryFn: getPaymentStatus,
  });
  // Credentials present — used to decide whether the connect button says
  // "Connect" or "Settings".
  const mpesaConfigured = paymentStatus?.data?.mpesa?.isConfigured ?? false;
  // Actually usable for an STK prompt: credentials present AND not switched
  // off server-side. These are two separate stored booleans (PaymentConfig's
  // `enabled` vs. derived `isConfigured`) that stay in sync only by
  // convention today — checking both here means a future divergence fails
  // safe instead of silently offering STK the backend will reject.
  const mpesaUsable = mpesaConfigured && paymentStatus?.data?.mpesa?.enabled !== false;
  const [mpesaSetupOpen, setMpesaSetupOpen] = useState(false);

  // null means "untouched, follow the server". Once the owner edits anything
  // the draft takes over, so a background refetch can't wipe unsaved changes.
  //
  // Derived rather than seeded from an effect: the effect version rendered an
  // empty list on first paint and filled it in on the next, which flashed the
  // "no methods" state over a shop that has them.
  const [draft, setDraft] = useState<ShopPaymentMethod[] | null>(null);
  const [newLabel, setNewLabel] = useState('');

  const serverMethods = useMemo(() => {
    const stored = shopConfig?.data?.paymentMethods;
    return (stored?.length ? stored : DEFAULT_SALE_METHODS).map((m) => ({ ...m }));
  }, [shopConfig]);

  const methods = draft ?? serverMethods;
  const dirty = draft !== null;

  /** Edits always branch from what's on screen, server-backed or not. */
  const setMethods = (update: (prev: ShopPaymentMethod[]) => ShopPaymentMethod[]) =>
    setDraft((prev) => update(prev ?? serverMethods));

  const saveMutation = useMutation({
    mutationFn: (next: ShopPaymentMethod[]) =>
      updateShopConfig({
        paymentMethods: next.map((m, i) => ({
          key: m.key,
          label: m.label.trim(),
          icon: m.icon ?? 'wallet',
          enabled: m.enabled !== false,
          order: i,
        })),
      }),
    onSuccess: (res) => {
      setDraft(null);
      queryClient.setQueryData(['shopConfig'], res);
      queryClient.invalidateQueries({ queryKey: ['shopConfig'] });
      haptics.success();
      toast({ type: 'success', message: 'Payment buttons updated.' });
    },
    onError: (err: any) => {
      toast({
        type: 'error',
        message: err?.response?.data?.message ?? err?.message ?? 'Could not save. Try again.',
      });
    },
  });

  const update = (key: string, patch: Partial<ShopPaymentMethod>) => {
    setMethods((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= methods.length) return;
    haptics.light();
    setMethods((prev) => {
      const next = prev.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const add = (method: ShopPaymentMethod) => {
    if (methods.length >= MAX_METHODS) {
      toast({ type: 'warning', message: `That's the ${MAX_METHODS}-button limit.` });
      return;
    }
    if (methods.some((m) => m.key === method.key)) {
      toast({ type: 'warning', message: `${method.label} is already on the till.` });
      return;
    }
    haptics.light();
    setMethods((prev) => [...prev, { ...method, enabled: true }]);
  };

  const addCustom = () => {
    const label = newLabel.trim();
    if (label.length < 2) {
      toast({ type: 'warning', message: 'Give the button a name first.' });
      return;
    }
    const key = slugifyMethodKey(label);
    if (!key) {
      toast({ type: 'warning', message: 'Use letters or numbers in the name.' });
      return;
    }
    add({ key, label: label.slice(0, 24), icon: 'wallet' });
    setNewLabel('');
  };

  const remove = (method: ShopPaymentMethod) => {
    alert({
      type: 'confirm',
      title: `Remove ${method.label}?`,
      // Past sales keep the label they were recorded under, so removing a
      // button never rewrites history — worth saying, because it's the thing
      // an owner would reasonably fear.
      message: 'It disappears from the till. Sales already recorded with it stay exactly as they are.',
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        {
          label: 'Remove',
          variant: 'danger',
          onPress: () => {
            haptics.light();
            setMethods((prev) => prev.filter((m) => m.key !== method.key));
          },
        },
      ],
    });
  };

  const enabledCount = methods.filter((m) => m.enabled !== false).length;
  const suggestions = useMemo(
    () => SUGGESTED_SALE_METHODS.filter((s) => !methods.some((m) => m.key === s.key)),
    [methods]
  );

  const handleSave = () => {
    if (enabledCount === 0) {
      toast({ type: 'warning', message: 'Keep at least one button switched on.' });
      return;
    }
    if (methods.some((m) => !m.label.trim())) {
      toast({ type: 'warning', message: 'Every button needs a name.' });
      return;
    }
    saveMutation.mutate(methods);
  };

  if (isLoading && methods.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInUp.duration(320)}>
          <Text style={styles.intro}>
            These are the buttons your cashier sees when finishing a sale. Every one of them records
            the sale and prints a receipt.
          </Text>
        </Animated.View>

        {/* ── The till's buttons ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>ON THE TILL</Text>
        <View style={styles.card}>
          {methods.map((method, index) => {
            const isMpesa = method.key === MPESA_METHOD_KEY;
            const isCash = method.key === CASH_METHOD_KEY;
            return (
              <Animated.View key={method.key} layout={LinearTransition.duration(200)}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <View style={styles.reorder}>
                    <AnimatedPressable
                      onPress={() => move(index, -1)}
                      disabled={index === 0}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${method.label} up`}
                    >
                      <Ionicons
                        name="chevron-up"
                        size={16}
                        color={index === 0 ? Colors.border : Colors.textTertiary}
                      />
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() => move(index, 1)}
                      disabled={index === methods.length - 1}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${method.label} down`}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={index === methods.length - 1 ? Colors.border : Colors.textTertiary}
                      />
                    </AnimatedPressable>
                  </View>

                  <View style={styles.iconWrap}>
                    <Ionicons name={methodIcon(method) as any} size={17} color={Colors.primary} />
                  </View>

                  <View style={styles.rowText}>
                    <TextInput
                      style={styles.labelInput}
                      value={method.label}
                      onChangeText={(text) => update(method.key, { label: text.slice(0, 24) })}
                      placeholder="Button name"
                      placeholderTextColor={Colors.textTertiary}
                      maxLength={24}
                      accessibilityLabel={`Name for the ${method.label} button`}
                    />
                    {isMpesa && (
                      <Text style={styles.rowHint}>
                        {mpesaUsable
                          ? 'Connected — sends an STK prompt to the customer'
                          : 'Records the sale and prints. Connect M-Pesa Business for STK prompts.'}
                      </Text>
                    )}
                    {isCash && <Text style={styles.rowHint}>Counted as till cash when reconciling shifts</Text>}
                  </View>

                  <Switch
                    value={method.enabled !== false}
                    onValueChange={(value) => update(method.key, { enabled: value })}
                    trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                    thumbColor={method.enabled !== false ? Colors.primary : Colors.textTertiary}
                  />

                  {/* Cash and M-Pesa are switched off rather than deleted —
                      they carry behaviour the rest of the app looks for. */}
                  {!isCash && !isMpesa && (
                    <AnimatedPressable
                      onPress={() => remove(method)}
                      hitSlop={8}
                      style={styles.removeBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${method.label}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                    </AnimatedPressable>
                  )}
                </View>
              </Animated.View>
            );
          })}
        </View>

        {/* ── Add ────────────────────────────────────────────────────────── */}
        {suggestions.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ADD A BUTTON</Text>
            <View style={styles.chipWrap}>
              {suggestions.map((s) => (
                <AnimatedPressable
                  key={s.key}
                  style={styles.chip}
                  onPress={() => add(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${s.label}`}
                >
                  <Ionicons name={methodIcon(s) as any} size={15} color={Colors.primary} />
                  <Text style={styles.chipText}>{s.label}</Text>
                  <Ionicons name="add" size={14} color={Colors.textTertiary} />
                </AnimatedPressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>OR NAME YOUR OWN</Text>
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            value={newLabel}
            onChangeText={setNewLabel}
            placeholder="e.g. Sacco, Equity Bank, Deni"
            placeholderTextColor={Colors.textTertiary}
            maxLength={24}
            returnKeyType="done"
            onSubmitEditing={addCustom}
            accessibilityLabel="Name for a new payment button"
          />
          <Button title="Add" variant="outline" size="sm" onPress={addCustom} />
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.noteText}>
            Buttons other than M-Pesa don&apos;t talk to any payment provider yet — they record how
            the customer paid so your reports and cashbook are right.
          </Text>
        </View>

        {/* Used to route to /(owner)/payments — that's the M-Pesa transaction
            ledger, not a setup screen, so tapping "Connect" was a dead end.
            Opens the real connect/verify/credentials flow inline instead. */}
        <AnimatedPressable
          style={styles.linkRow}
          onPress={() => setMpesaSetupOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: mpesaSetupOpen }}
          accessibilityLabel={mpesaSetupOpen ? 'Close M-Pesa Business setup' : 'Open M-Pesa Business setup'}
        >
          <Ionicons name="link-outline" size={16} color={Colors.primary} />
          <Text style={styles.linkText}>
            {mpesaConfigured ? 'M-Pesa Business settings' : 'Connect M-Pesa Business for STK prompts'}
          </Text>
          <Ionicons
            name={mpesaSetupOpen ? 'chevron-up' : 'chevron-forward'}
            size={15}
            color={Colors.textTertiary}
          />
        </AnimatedPressable>

        {mpesaSetupOpen && (
          <Animated.View entering={FadeInUp.duration(220)} style={styles.mpesaSetupPanel}>
            <PaymentsSection
              onChange={() => queryClient.invalidateQueries({ queryKey: ['paymentStatus'] })}
            />
          </Animated.View>
        )}

        <AnimatedPressable
          style={styles.linkRow}
          onPress={() => router.push('/(owner)/payments')}
          accessibilityRole="button"
          accessibilityLabel="View M-Pesa transactions"
        >
          <Ionicons name="receipt-outline" size={16} color={Colors.textSecondary} />
          <Text style={[styles.linkText, styles.linkTextSecondary]}>View M-Pesa transactions</Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
        </AnimatedPressable>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={dirty ? 'Save changes' : 'Saved'}
          onPress={handleSave}
          disabled={!dirty || saveMutation.isPending}
          loading={saveMutation.isPending}
          leftIcon={dirty ? undefined : 'checkmark-circle'}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  intro: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  reorder: { gap: 2 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  labelInput: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    paddingVertical: 2,
  },
  rowHint: {
    fontSize: Typography.size.caption,
    color: Colors.textTertiary,
    lineHeight: 15,
  },
  removeBtn: { padding: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  customInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.size.small,
    color: Colors.textPrimary,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
  },
  noteText: {
    flex: 1,
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  linkText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  linkTextSecondary: { color: Colors.textSecondary },
  mpesaSetupPanel: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
});
