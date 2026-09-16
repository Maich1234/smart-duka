import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet } from '@/components/ui/BottomSheet';
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

interface CustomerPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  currency?: string;
  /** Hides the "New customer" affordance for a user who may not create one. */
  canCreate?: boolean;
}

/**
 * Find the person at the counter, or add them without leaving the till.
 *
 * Search is the primary action because by the time a shop runs credit it has
 * regulars, and typing three letters beats scrolling a directory. Creating is
 * one tap away rather than a separate screen: a new customer standing at the
 * counter is the common case, not the exception, and sending the cashier off to
 * a form loses the cart.
 */
export const CustomerPickerSheet: React.FC<CustomerPickerSheetProps> = ({
  visible,
  onClose,
  onSelect,
  currency,
  canCreate = true,
}) => {
  // Shares its debounce and its recent terms with the Customers list — the
  // same names get looked up in both places, so remembering them twice under
  // two keys would just make one of the two lists wrong.
  const { value: search, query: debouncedSearch, onChange: setSearch, clear: clearSearch } = useSearch('credit_customers');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const { toast } = useAlert();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customers', 'picker', debouncedSearch],
    queryFn: () => getCustomers({ search: debouncedSearch || undefined, limit: 30, sort: 'name' }),
    enabled: visible,
    // Keeps the previous matches on screen while the next query lands, so the
    // list doesn't blink to a spinner on every keystroke.
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: () => createCustomer({ name: newName.trim(), phone: newPhone.trim() || undefined }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      reset();
      onSelect(res.data);
    },
    onError: (error) => {
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not add the customer') });
    },
  });

  const reset = () => {
    setCreating(false);
    setNewName('');
    setNewPhone('');
    clearSearch();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const customers = data?.data ?? [];

  if (creating) {
    return (
      <BottomSheet
        visible={visible}
        onClose={handleClose}
        maxHeightPercent={70}
        footer={
          <View style={styles.footer}>
            <Button title="Cancel" variant="ghost" onPress={() => setCreating(false)} style={styles.flex1} />
            <Button
              title="Add & Select"
              onPress={() => createMutation.mutate()}
              disabled={newName.trim().length === 0 || createMutation.isPending}
              loading={createMutation.isPending}
              style={styles.flex2}
              accessibilityHint={newName.trim() ? undefined : 'Enter the customer’s name first'}
            />
          </View>
        }
      >
        <View style={styles.body}>
          <Text style={styles.heading}>New customer</Text>
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
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose} maxHeightPercent={85}>
      <View style={styles.body}>
        <Text style={styles.heading}>Who is this for?</Text>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={17} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or phone"
            placeholderTextColor={Colors.textTertiary}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search customers"
          />
          {search.length > 0 && (
            <AnimatedPressable
              onPress={clearSearch}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
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
            {search
              ? 'Check the spelling, or add them as a new customer.'
              : 'Add the first person you sell to on credit.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item, index }) => {
            const owes = (item.account?.outstanding ?? 0) > 0;
            return (
              <AnimatedPressable
                onPress={() => { reset(); onSelect(item); }}
                style={[styles.row, index < customers.length - 1 && styles.divider]}
                pressScale={Motion.press.scaleCard}
                accessibilityRole="button"
                accessibilityLabel={
                  owes
                    ? `${item.name}, owes ${formatCurrency(item.account!.outstanding, currency)}`
                    : item.name
                }
              >
                <View style={styles.flex1}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.phone || 'No phone number'}
                  </Text>
                </View>
                {owes && (
                  <Text
                    style={[
                      styles.rowAmount,
                      item.account?.status === 'overdue' && styles.rowAmountOverdue,
                    ]}
                  >
                    {formatCurrency(item.account!.outstanding, currency)}
                  </Text>
                )}
              </AnimatedPressable>
            );
          }}
        />
      )}

      {canCreate && (
        <View style={styles.createRow}>
          <Button
            title={search.trim() ? `Add “${search.trim()}”` : 'New customer'}
            variant="outline"
            leftIcon="person-add-outline"
            onPress={() => { setNewName(search.trim()); setCreating(true); }}
          />
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
  heading: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.body,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily,
    // Android centres text oddly in a fixed-height row without this.
    paddingVertical: 0,
  },
  list: { maxHeight: 340 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    minHeight: 56,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  rowName: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  rowMeta: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 1 },
  rowAmount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  rowAmountOverdue: { color: Colors.danger },
  centered: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  emptyTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  createRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  limitNote: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  footer: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
});
