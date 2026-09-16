import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useAlert } from '@/context/AlertContext';
import { useSearch } from '@/hooks/useSearch';
import { getCustomers, createCustomer, type Customer } from '@/services/customers';
import { mutationErrorMessage } from '@/utils/errors';
import { formatCurrency } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';

interface CustomerPickerScreenProps {
  onSelect: (customer: Customer) => void;
  currency?: string;
}

/**
 * Full-page customer picker for the till's credit checkout.
 *
 * A dedicated screen rather than a sheet: choosing who a debt belongs to is
 * the one decision in the credit flow that deserves the full keyboard-clear
 * height a search list needs, and it's common enough at a shop running credit
 * that squeezing it into a partial-height sheet under the checkout panel
 * cramped both the results and the new-customer form. The same search-then-
 * create logic as before, just given the room a real screen provides.
 *
 * Returns its result the same way the staff "Permissions" sub-screen already
 * does: writing to a shared store and calling `router.back()`, not a prop
 * callback that can't survive across a route push.
 */
export const CustomerPickerScreen: React.FC<CustomerPickerScreenProps> = ({ onSelect, currency }) => {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const { toast } = useAlert();
  const queryClient = useQueryClient();

  const { value: search, query: debouncedSearch, onChange: setSearch, clear: clearSearch } = useSearch('credit_customers');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customers', 'picker', debouncedSearch],
    queryFn: () => getCustomers({ search: debouncedSearch || undefined, limit: 40, sort: 'name' }),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: () => createCustomer({ name: newName.trim(), phone: newPhone.trim() || undefined }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onSelect(res.data);
    },
    onError: (error) => {
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not add the customer') });
    },
  });

  const customers = data?.data ?? [];

  if (creating) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title="New Customer" onBack={() => setCreating(false)} />
        <View style={styles.form}>
          <Input
            label="Name"
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Mama Njeri"
            autoFocus
            autoCapitalize="words"
            returnKeyType="next"
          />
          <Input
            label="Phone (optional)"
            value={newPhone}
            onChangeText={setNewPhone}
            placeholder="e.g. 0712345678"
            keyboardType="phone-pad"
            hint="Useful when you need to call about a debt."
          />
          <Text style={styles.limitNote}>
            They&rsquo;ll start on the shop&rsquo;s default credit limit. Only the owner can change it.
          </Text>
          <Button
            title="Add & Select"
            onPress={() => createMutation.mutate()}
            disabled={newName.trim().length === 0 || createMutation.isPending}
            loading={createMutation.isPending}
            style={styles.createBtn}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Who is this for?" />

      <View style={styles.searchWrap}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={17} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or phone"
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search customers"
          />
          {search.length > 0 && (
            <AnimatedPressable onPress={clearSearch} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={Colors.textTertiary} />
            </AnimatedPressable>
          )}
        </View>
      </View>

      {isLoading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Couldn&rsquo;t load customers</Text>
          <Text style={styles.emptyText}>Check your connection and try again.</Text>
          <Button title="Retry" variant="outline" size="sm" onPress={() => refetch()} />
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>
            {search ? `No one matching “${search}”` : 'No customers yet'}
          </Text>
          <Text style={styles.emptyText}>
            {search ? 'Check the spelling, or add them as a new customer.' : 'Add the first person you sell to on credit.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const owes = (item.account?.outstanding ?? 0) > 0;
            return (
              <AnimatedPressable
                onPress={() => onSelect(item)}
                style={[styles.row, index < customers.length - 1 && styles.divider]}
                pressScale={Motion.press.scaleCard}
                accessibilityRole="button"
                accessibilityLabel={owes ? `${item.name}, owes ${formatCurrency(item.account!.outstanding, currency)}` : item.name}
              >
                <View style={styles.flex1}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>{item.phone || 'No phone number'}</Text>
                </View>
                {owes && (
                  <Text style={[styles.rowAmount, item.account?.status === 'overdue' && styles.rowAmountOverdue]}>
                    {formatCurrency(item.account!.outstanding, currency)}
                  </Text>
                )}
              </AnimatedPressable>
            );
          }}
        />
      )}

      <View style={styles.createRow}>
        <Button
          title={search.trim() ? `Add “${search.trim()}”` : 'New customer'}
          variant="outline"
          leftIcon="person-add-outline"
          onPress={() => { setNewName(search.trim()); setCreating(true); }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  flex1: { flex: 1 },
  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.body,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily,
    paddingVertical: 0,
  },
  listContent: { paddingBottom: Spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 13,
    paddingHorizontal: Spacing.lg,
    minHeight: 58,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  rowName: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  rowMeta: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 1 },
  rowAmount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  rowAmountOverdue: { color: Colors.danger },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, textAlign: 'center' },
  emptyText: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center' },
  createRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.background,
  },
  form: { padding: Spacing.lg, gap: Spacing.md },
  limitNote: { fontSize: Typography.size.caption, color: Colors.textSecondary, lineHeight: 17 },
  createBtn: { marginTop: Spacing.sm },
});
