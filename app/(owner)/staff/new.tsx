import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useAlert } from '@/context/AlertContext';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { createStaff, updateStaffPermissions, checkStaffEmailAvailability, previewSeatAddition } from '@/services/staff';
import { formatCurrency } from '@/utils/formatters';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useStaffDraftStore } from '@/store/staffDraftStore';
import { useAuthStore } from '@/store/authStore';
import { buildSystemEmailDomain, slugifyLocalPart } from '@/utils/staffEmailSlug';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const DEFAULT_STAFF_PERMISSIONS = ['view_products', 'record_sale', 'view_sales'];

type EmailMode = 'real' | 'system';
type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export default function NewStaffScreen() {
  const queryClient = useQueryClient();
  const tabBarHeight = useTabBarHeight();
  const { permissions, setPermissions, reset } = useStaffDraftStore();
  const shopName = useAuthStore((s) => s.user?.shop?.name) ?? '';
  const domain = useMemo(() => buildSystemEmailDomain(shopName), [shopName]);

  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [emailMode, setEmailMode] = useState<EmailMode>('real');
  // Only what the owner actually typed is state. The suggestion is derived from
  // the name below, so there's nothing to synchronise in an effect.
  const [typedLocalPart, setTypedLocalPart] = useState('');
  const [localPartTouched, setLocalPartTouched] = useState(false);
  const [availability, setAvailability] = useState<Availability>('idle');
  const { toast } = useAlert();

  // Disclosure only — seats are postpaid, so there is nothing to pay here and
  // a failure to load this must never block adding a team member.
  const { data: seatPreview } = useQuery({
    queryKey: ['staff', 'seatPreview'],
    queryFn: previewSeatAddition,
    staleTime: 60_000,
    retry: false,
  });

  // Seeds the shared draft store on mount and clears it on the way out. The
  // deps are zustand actions, created once by the store, so declaring them
  // honestly keeps this mount-only without silencing the lint rule.
  useEffect(() => {
    setPermissions(DEFAULT_STAFF_PERMISSIONS);
    return () => reset();
  }, [setPermissions, reset]);

  // Suggested from the name until the owner edits it directly. Derived rather
  // than mirrored into state via an effect: the effect version re-rendered on
  // every keystroke of the name field just to catch its own state up.
  const localPart = localPartTouched ? typedLocalPart : slugifyLocalPart(form.name);

  const systemEmail = `${localPart}@${domain}`;
  const successMessage = emailMode === 'system'
    ? 'Staff added — they can sign in right away.'
    : 'Staff added — ask them to check their email to verify before signing in.';

  const checkAvailability = async () => {
    if (!localPart) return;
    setAvailability('checking');
    try {
      const { available } = await checkStaffEmailAvailability(systemEmail);
      setAvailability(available ? 'available' : 'taken');
    } catch {
      setAvailability('error');
    }
  };

  const finishAndLeave = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
    toast({ type: 'success', message });
    router.back();
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const email = emailMode === 'system' ? systemEmail : form.email;
      const created = await createStaff({
        name: form.name,
        email,
        password: form.password,
        phone: form.phone || undefined,
      });
      const staffId = created.data._id;
      await updateStaffPermissions(staffId, permissions);
      return created;
    },
    onSuccess: (created) => {
      // The server reports what the seat actually added, prorated. Prefer it
      // over the preview — head-count may have moved since the screen loaded.
      const billed = created.billing?.addedToNextInvoice;
      finishAndLeave(
        billed
          ? `${successMessage} ${formatCurrency(billed, seatPreview?.currency ?? 'KES')} will be added to your next bill.`
          : successMessage,
      );
    },
    onError: (error: any) => {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to add staff' });
    },
  });

  const handleSave = () => {
    if (!form.name) {
      return toast({ type: 'error', message: 'Name is required' });
    }
    if (emailMode === 'real' && !form.email) {
      return toast({ type: 'error', message: 'Email is required' });
    }
    if (emailMode === 'system' && !localPart) {
      return toast({ type: 'error', message: 'Enter a username for the generated email' });
    }
    if (emailMode === 'system' && availability === 'taken') {
      return toast({ type: 'error', message: 'That email is already taken — try another' });
    }
    if (!form.password || form.password.length < 6) {
      return toast({ type: 'error', message: 'Password must be at least 6 characters' });
    }
    saveMutation.mutate();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BASIC INFORMATION</Text>
          <Input label="Full Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />

          <View style={styles.toggleRow}>
            <AnimatedPressable
              style={[styles.toggleOption, emailMode === 'real' && styles.toggleOptionActive]}
              onPress={() => setEmailMode('real')}
              accessibilityRole="button"
              accessibilityState={{ selected: emailMode === 'real' }}
            >
              <Text style={[styles.toggleOptionText, emailMode === 'real' && styles.toggleOptionTextActive]}>Real email</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.toggleOption, emailMode === 'system' && styles.toggleOptionActive]}
              onPress={() => setEmailMode('system')}
              accessibilityRole="button"
              accessibilityState={{ selected: emailMode === 'system' }}
            >
              <Text style={[styles.toggleOptionText, emailMode === 'system' && styles.toggleOptionTextActive]}>System-generated</Text>
            </AnimatedPressable>
          </View>

          {emailMode === 'real' ? (
            <>
              <Input
                label="Email"
                value={form.email}
                onChangeText={(t) => setForm({ ...form, email: t })}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={styles.hint}>We&apos;ll email a verification code to this address before they can sign in.</Text>
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.emailRow}>
                <TextInput
                  style={styles.emailLocalInput}
                  value={localPart}
                  onChangeText={(t) => {
                    setLocalPartTouched(true);
                    setTypedLocalPart(t.toLowerCase().replace(/[^a-z0-9.]/g, ''));
                    setAvailability('idle');
                  }}
                  onBlur={checkAvailability}
                  placeholder="jane.otieno"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="none"
                  accessibilityLabel="Email username"
                />
                <View style={styles.emailSuffixBox}>
                  <Text style={styles.emailSuffixText} numberOfLines={1}>@{domain}</Text>
                </View>
              </View>
              {availability === 'checking' && (
                <View style={styles.availabilityRow}>
                  <ActivityIndicator size="small" color={Colors.textTertiary} />
                  <Text style={styles.hint}>Checking availability…</Text>
                </View>
              )}
              {availability === 'available' && (
                <View style={styles.availabilityRow}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                  <Text style={[styles.hint, { color: Colors.success }]}>Available</Text>
                </View>
              )}
              {availability === 'taken' && (
                <View style={styles.availabilityRow}>
                  <Ionicons name="close-circle" size={14} color={Colors.danger} />
                  <Text style={[styles.hint, { color: Colors.danger }]}>This email is taken — try another</Text>
                </View>
              )}
              {availability === 'idle' && (
                <Text style={styles.hint}>Auto-verified — ready to use immediately, no email needed.</Text>
              )}
            </>
          )}

          <Input label="Phone (optional)" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <Input label="Password" value={form.password} onChangeText={(t) => setForm({ ...form, password: t })} secureTextEntry />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCESS</Text>
          <AnimatedPressable style={styles.permissionsRow} onPress={() => router.push('/(owner)/staff/permissions')}>
            <View style={styles.permissionsIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.permissionsText}>
              <Text style={styles.permissionsLabel}>Permissions</Text>
              <Text style={styles.permissionsCount}>{permissions.length} permission{permissions.length !== 1 ? 's' : ''} selected</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </AnimatedPressable>
        </View>

        {/* Postpaid seat disclosure. No payment happens on this screen —
            the team member is active immediately and the prorated cost
            appears on the next invoice. */}
        {seatPreview?.willCharge && (
          <View style={styles.billingNote}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
            <Text style={styles.billingNoteText}>
              This adds {formatCurrency(seatPreview.amount, seatPreview.currency)} to your next bill
              {seatPreview.nextInvoiceAt
                ? ` on ${new Date(seatPreview.nextInvoiceAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}`
                : ''}
              . They can start work right away.
            </Text>
          </View>
        )}

        <Button title="Add Staff Member" onPress={handleSave} loading={saveMutation.isPending} style={styles.button} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
    marginBottom: Spacing.sm,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md - 4,
    alignItems: 'center',
  },
  toggleOptionActive: {
    backgroundColor: Colors.primarySubtle,
  },
  toggleOptionText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
  },
  toggleOptionTextActive: {
    color: Colors.primary,
  },
  fieldLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  emailLocalInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
  },
  emailSuffixBox: {
    maxWidth: '45%',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
  },
  emailSuffixText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  hint: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  permissionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  permissionsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionsText: { flex: 1 },
  permissionsLabel: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  permissionsCount: { fontSize: Typography.size.small, color: Colors.textSecondary, marginTop: 2 },
  billingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: '#EFF6FF',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  billingNoteText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  button: { marginTop: Spacing.sm },
});
