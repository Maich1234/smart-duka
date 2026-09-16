import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { QueryError } from '@/components/ui/QueryError';
import { useAlert } from '@/context/AlertContext';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { getCustomerById, updateCustomer } from '@/services/customers';
import { mutationErrorMessage } from '@/utils/errors';
import { formatCurrency } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface CustomerEdits {
  name?: string;
  phone?: string;
  notes?: string;
  customLimit?: boolean;
  limitText?: string;
  blocked?: boolean;
  blockedReason?: string;
}

/**
 * Owner-only. Contact details plus the two fields that decide the shop's
 * exposure: a bespoke credit limit and whether this person is blocked from
 * taking more credit at all.
 *
 * Only the owner's edits are state; everything else is read straight off the
 * server response, merged at render time — the same pattern
 * staff/[id]/edit.tsx uses, and for the same reason: seeding local state from
 * a fetch inside an effect leaves one render where the data has arrived but
 * the fields are still blank.
 *
 * Every write here is server-verified as owner-only regardless of what this
 * screen shows — this UI hiding the fields from staff is a convenience, not
 * the enforcement.
 */
export default function EditCustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tabBarHeight = useTabBarHeight();
  const { toast, alert } = useAlert();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomerById(id),
  });
  const customer = data?.data;

  const [edits, setEdits] = useState<CustomerEdits>({});
  const updateEdits = (patch: CustomerEdits) => setEdits((e) => ({ ...e, ...patch }));

  const hasCustomLimit = customer?.account?.creditLimitSource === 'customer';
  const form = {
    name: edits.name ?? customer?.name ?? '',
    phone: edits.phone ?? customer?.phone ?? '',
    notes: edits.notes ?? customer?.notes ?? '',
    customLimit: edits.customLimit ?? hasCustomLimit,
    limitText: edits.limitText ?? (hasCustomLimit ? String(customer?.account?.creditLimit ?? '') : ''),
    // ?? not ||, so unblocking isn't overwritten by a stale server value mid-edit.
    blocked: edits.blocked ?? customer?.account?.blocked ?? false,
    blockedReason: edits.blockedReason ?? customer?.account?.blockedReason ?? '',
  };

  const mutation = useMutation({
    mutationFn: () => updateCustomer(id, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      notes: form.notes.trim(),
      creditLimit: form.customLimit ? Number.parseFloat(form.limitText || '0') : null,
      creditBlocked: form.blocked,
      creditBlockedReason: form.blocked ? form.blockedReason.trim() : '',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ type: 'success', message: 'Customer updated' });
      router.back();
    },
    onError: (error) => {
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not update the customer') });
    },
  });

  if (isLoading) return <LoadingState />;
  if (isError || !customer) return <QueryError onRetry={refetch} />;

  const shopDefaultLimit = customer.account && customer.account.creditLimitSource === 'shop'
    ? customer.account.creditLimit
    : undefined;

  const confirmBlockToggle = (next: boolean) => {
    if (!next) { updateEdits({ blocked: false }); return; }
    alert({
      type: 'confirm',
      title: 'Block from credit?',
      message: `${form.name || 'This customer'} will not be able to take new credit sales until you unblock them. Their existing balance and history are unaffected.`,
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Block', variant: 'danger', onPress: () => updateEdits({ blocked: true }) },
      ],
    });
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.xl }]}>
        <Text style={styles.sectionLabel}>Contact</Text>
        <Input label="Name" value={form.name} onChangeText={(v) => updateEdits({ name: v })} autoCapitalize="words" />
        <Input label="Phone" value={form.phone} onChangeText={(v) => updateEdits({ phone: v })} keyboardType="phone-pad" />
        <Input label="Notes" value={form.notes} onChangeText={(v) => updateEdits({ notes: v })} multiline hint="Only you and staff with credit access see this." />

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>Credit limit</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Custom limit</Text>
            <Text style={styles.rowSubtitle}>
              {shopDefaultLimit != null
                ? `Off follows the shop default (${formatCurrency(shopDefaultLimit)})`
                : 'Off follows the shop default'}
            </Text>
          </View>
          <Switch
            value={form.customLimit}
            onValueChange={(v) => updateEdits({ customLimit: v })}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={form.customLimit ? Colors.primary : Colors.textTertiary}
          />
        </View>
        {form.customLimit && (
          <Input
            label="Credit limit"
            value={form.limitText}
            onChangeText={(v) => updateEdits({ limitText: v.replace(/[^0-9.]/g, '') })}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        )}

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>Access</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Block from credit</Text>
            <Text style={styles.rowSubtitle}>Stops new credit sales. Repayments and history are unaffected.</Text>
          </View>
          <Switch
            value={form.blocked}
            onValueChange={confirmBlockToggle}
            trackColor={{ false: Colors.border, true: Colors.dangerSubtle }}
            thumbColor={form.blocked ? Colors.danger : Colors.textTertiary}
          />
        </View>
        {form.blocked && (
          <Input
            label="Reason (shown to staff at checkout)"
            value={form.blockedReason}
            onChangeText={(v) => updateEdits({ blockedReason: v })}
            placeholder="e.g. Repeated late payment"
          />
        )}

        <Button
          title="Save Changes"
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={form.name.trim().length === 0}
          style={styles.saveBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionSpacer: { marginTop: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  rowSubtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, lineHeight: 15 },
  saveBtn: { marginTop: Spacing.lg },
});
