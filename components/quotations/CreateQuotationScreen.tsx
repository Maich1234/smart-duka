import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { DatePicker } from '@/components/ui/DatePicker';
import { CustomerPickerSheet } from '@/components/credit/CustomerPickerSheet';
import { ServicePickerSheet } from '@/components/quotations/ServicePickerSheet';
import { useAlert } from '@/context/AlertContext';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { usePermission } from '@/utils/permissions';
import { useAuthStore } from '@/store/authStore';
import { createQuotation } from '@/services/quotations';
import type { Customer } from '@/services/customers';
import type { Product } from '@/services/products';
import { mutationErrorMessage } from '@/utils/errors';
import { formatCurrency } from '@/utils/formatters';
import { randomUUID } from '@/utils/uuid';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface CreateQuotationScreenProps {
  /** Where the list this quotation joins lives — differs only by route group
   * between owner and staff, same shape as CustomerListScreen's basePath. */
  basePath: '/(owner)/quotations' | '/(staff)/quotations';
}

interface LineItem {
  key: string;
  /** Present for a catalog line, absent for a free-text custom line. */
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

const DEFAULT_VALID_DAYS = 30;

/**
 * Drafts a quotation for a customer: pick who it's for, add service-catalog
 * or free-text line items, set how long it stands, and send it off. The
 * server recomputes the total authoritatively on submit — the running total
 * shown here is purely so whoever is filling this in sees a live number.
 */
export const CreateQuotationScreen: React.FC<CreateQuotationScreenProps> = ({ basePath }) => {
  const tabBarHeight = useTabBarHeight();
  const currency = useAuthStore((s) => s.user?.shop?.currency);
  const canCreate = usePermission('create_quotation');
  const { toast } = useAlert();

  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [servicePickerVisible, setServicePickerVisible] = useState(false);
  const [addingCustomLine, setAddingCustomLine] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');
  const [customUnitPrice, setCustomUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState(() => new Date(Date.now() + DEFAULT_VALID_DAYS * 86400000));

  const mutation = useMutation({
    mutationFn: createQuotation,
    onSuccess: () => {
      toast({ type: 'success', message: 'Quotation created.' });
      // The Quotations list (Task 19) lives at this same basePath.
      router.replace(basePath as never);
    },
    onError: (error) => {
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not create the quotation') });
    },
  });

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const addServiceItem = (product: Product) => {
    setItems((prev) => [
      ...prev,
      {
        key: randomUUID(),
        productId: product._id,
        name: product.name,
        description: product.description,
        quantity: 1,
        unitPrice: product.sellingPrice,
      },
    ]);
    setServicePickerVisible(false);
  };

  const resetCustomLineForm = () => {
    setAddingCustomLine(false);
    setCustomName('');
    setCustomDescription('');
    setCustomQuantity('1');
    setCustomUnitPrice('');
  };

  const customQuantityNumber = Number.parseFloat(customQuantity || '0');
  const customUnitPriceNumber = Number.parseFloat(customUnitPrice || '0');
  const canConfirmCustomLine = customName.trim().length > 0 && customQuantityNumber > 0 && customUnitPrice.trim().length > 0;

  const confirmCustomLine = () => {
    if (!canConfirmCustomLine) return;
    setItems((prev) => [
      ...prev,
      {
        key: randomUUID(),
        name: customName.trim(),
        description: customDescription.trim() || undefined,
        quantity: customQuantityNumber,
        unitPrice: customUnitPriceNumber,
      },
    ]);
    resetCustomLineForm();
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const canSubmit = !!customer && items.length > 0 && !mutation.isPending;

  const handleSubmit = () => {
    if (!customer || items.length === 0) return;
    mutation.mutate({
      customerId: customer._id,
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      notes: notes.trim() || undefined,
      validUntil: validUntil.toISOString(),
    });
  };

  if (!canCreate) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.restrictedText}>You do not have permission to create quotations.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="New Quotation" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <AnimatedPressable style={styles.customerRow} onPress={() => setCustomerPickerVisible(true)}>
          <View style={styles.customerIconWrap}>
            <Ionicons name="person-outline" size={16} color={Colors.primary} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.customerLabel}>Customer</Text>
            <Text style={styles.customerValue} numberOfLines={1}>
              {customer ? customer.name : 'Select a customer'}
            </Text>
            {customer?.phone ? <Text style={styles.customerMeta}>{customer.phone}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </AnimatedPressable>

        <Text style={styles.sectionTitle}>Items</Text>

        {items.length === 0 ? (
          <Text style={styles.emptyItemsText}>Add a service or a custom line to build this quotation.</Text>
        ) : (
          items.map((item) => (
            <View key={item.key} style={styles.itemRow}>
              <View style={styles.flex1}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} × {formatCurrency(item.unitPrice, currency)} = {formatCurrency(item.quantity * item.unitPrice, currency)}
                </Text>
              </View>
              <AnimatedPressable
                onPress={() => removeItem(item.key)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name}`}
              >
                <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
              </AnimatedPressable>
            </View>
          ))
        )}

        <View style={styles.addButtonsRow}>
          <Button
            title="Add service"
            variant="outline"
            size="sm"
            leftIcon="briefcase-outline"
            onPress={() => setServicePickerVisible(true)}
            style={styles.flex1}
          />
          <Button
            title="Add custom line"
            variant="outline"
            size="sm"
            leftIcon="add-outline"
            onPress={() => setAddingCustomLine(true)}
            style={styles.flex1}
          />
        </View>

        {addingCustomLine && (
          <View style={styles.customLineForm}>
            <Input
              label="Name"
              value={customName}
              onChangeText={setCustomName}
              placeholder="e.g. Home visit"
              autoFocus
              returnKeyType="next"
            />
            <Input
              label="Description (optional)"
              value={customDescription}
              onChangeText={setCustomDescription}
              placeholder="e.g. Includes travel"
            />
            <View style={styles.customLineRow}>
              <Input
                label="Quantity"
                value={customQuantity}
                onChangeText={(t) => setCustomQuantity(t.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                style={styles.flex1}
              />
              <Input
                label="Unit price"
                value={customUnitPrice}
                onChangeText={(t) => setCustomUnitPrice(t.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                style={styles.flex1}
              />
            </View>
            <View style={styles.customLineFooter}>
              <Button title="Cancel" variant="ghost" onPress={resetCustomLineForm} style={styles.flex1} />
              <Button
                title="Add"
                onPress={confirmCustomLine}
                disabled={!canConfirmCustomLine}
                style={styles.flex2}
              />
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes for the customer"
          placeholderTextColor={Colors.textTertiary}
          multiline
          maxLength={500}
          accessibilityLabel="Notes"
        />

        <Text style={styles.sectionTitle}>Valid Until</Text>
        <DatePicker value={validUntil} onChange={(d) => d && setValidUntil(d)} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(total, currency)}</Text>
        </View>

        <Button
          title="Create Quotation"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={mutation.isPending}
          style={styles.submitButton}
          accessibilityHint={
            !customer ? 'Select a customer first' : items.length === 0 ? 'Add at least one item' : undefined
          }
        />
      </ScrollView>

      <CustomerPickerSheet
        visible={customerPickerVisible}
        onClose={() => setCustomerPickerVisible(false)}
        onSelect={(c) => { setCustomer(c); setCustomerPickerVisible(false); }}
        currency={currency}
      />

      <ServicePickerSheet
        visible={servicePickerVisible}
        onClose={() => setServicePickerVisible(false)}
        onSelect={addServiceItem}
        currency={currency}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.background },
  restrictedText: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: Typography.size.body, textAlign: 'center' },

  content: { padding: Spacing.lg },

  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  customerIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center' },
  customerLabel: { fontSize: Typography.size.caption, color: Colors.textSecondary },
  customerValue: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, marginTop: 1 },
  customerMeta: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 1 },

  sectionTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  emptyItemsText: { fontSize: Typography.size.small, color: Colors.textSecondary, marginBottom: Spacing.sm },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  itemName: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  itemMeta: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 1, fontVariant: ['tabular-nums'] },

  addButtonsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },

  customLineForm: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customLineRow: { flexDirection: 'row', gap: Spacing.sm },
  customLineFooter: { flexDirection: 'row', gap: Spacing.sm },

  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minHeight: 88,
    textAlignVertical: 'top',
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  totalLabel: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  totalValue: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },

  submitButton: { marginTop: Spacing.xs },
});
