import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { QueryError } from '@/components/ui/QueryError';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { CreditSummarySheet } from '@/components/credit/CreditSummarySheet';
import { MpesaPaymentModal } from '@/components/payments/MpesaPaymentModal';
import { isValidKenyanPhone } from '@/components/sales/CartSummary';
import { useAlert } from '@/context/AlertContext';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useShopConfig } from '@/hooks/useShopConfig';
import { usePermission } from '@/utils/permissions';
import { useAuthStore } from '@/store/authStore';
import { getQuotations, convertQuotation } from '@/services/quotations';
import { getCustomerById, type CreditAccount } from '@/services/customers';
import { getPaymentStatus } from '@/services/paymentConfig';
import {
  resolveSaleMethods,
  methodIcon,
  MPESA_METHOD_KEY,
  CREDIT_METHOD_KEY,
} from '@/constants/paymentMethods';
import { mutationErrorMessage } from '@/utils/errors';
import { formatCurrency } from '@/utils/formatters';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface ConvertQuotationScreenProps {
  quotationId: string;
  /** Where the list this quotation came from lives — differs only by route
   * group between owner and staff, same shape as this feature's other screens. */
  basePath: '/(owner)/quotations' | '/(staff)/quotations';
}

/**
 * Turns an already-drafted quotation into a real Sale. The line items are
 * already fixed by the time this screen opens — all that's left to decide is
 * how the customer is paying — so this is a small, self-contained screen
 * rather than a PosScreen integration: that cart is built around live
 * Product documents and doesn't accept a prefilled, already-fixed set of
 * line items including custom/non-catalog lines.
 *
 * Mirrors PosScreen's own credit-checkout block (openCreditSummary /
 * confirmCreditSale) and its mpesaEnabled gate, reusing the same
 * CreditSummarySheet and MpesaPaymentModal components so the two payment
 * flows behave identically to the till's.
 */
export const ConvertQuotationScreen: React.FC<ConvertQuotationScreenProps> = ({ quotationId, basePath }) => {
  const tabBarHeight = useTabBarHeight();
  const currency = useAuthStore((s) => s.user?.shop?.currency);
  const { toast } = useAlert();
  const queryClient = useQueryClient();
  const canConvert = usePermission('convert_quotation_to_sale');
  const canMakeCreditSale = usePermission('make_credit_sale');
  const { shopConfig } = useShopConfig();

  // getQuotations() resolves to the full {success, data, pagination} envelope,
  // not a bare array — there's no getQuotationById, so this finds the one
  // this screen is for out of the full list (same as QuotationsListScreen).
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => getQuotations(),
  });
  const quotation = data?.data?.find((q) => q._id === quotationId);

  // Credential presence AND the backend's own enabled flag — same two-flag
  // check as PosScreen's mpesaEnabled, so a shop without Daraja credentials
  // never gets offered an STK prompt the backend would reject; M-Pesa still
  // sells (recorded directly, no STK) for those shops via the plain branch
  // below.
  const { data: paymentStatusData } = useQuery({ queryKey: ['paymentStatus'], queryFn: getPaymentStatus });
  const mpesaEnabled =
    (paymentStatusData?.data?.mpesa?.isConfigured ?? false) &&
    paymentStatusData?.data?.mpesa?.enabled !== false;

  const creditEnabled = shopConfig?.creditSettings?.enabled ?? false;
  const methods = useMemo(
    () => resolveSaleMethods(shopConfig?.paymentMethods, {
      enabled: creditEnabled,
      permitted: canMakeCreditSale,
    }),
    [shopConfig, creditEnabled, canMakeCreditSale]
  );

  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  // Falls back to the first available button rather than a method the shop
  // no longer offers — same derived-not-corrected shape as PosScreen's
  // paymentMethod, so there's never a frame where a removed method is still
  // selected.
  const activeMethod = selectedMethod && methods.some((m) => m.key === selectedMethod)
    ? selectedMethod
    : methods[0]?.key ?? null;

  const [mpesaVisible, setMpesaVisible] = useState(false);

  // ── Credit checkout — mirrors PosScreen's openCreditSummary/confirmCreditSale ──
  const [creditSummaryVisible, setCreditSummaryVisible] = useState(false);
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null);
  const [creditSummaryError, setCreditSummaryError] = useState<string | null>(null);
  const [creditSummaryLoading, setCreditSummaryLoading] = useState(false);

  const { mutate: submitConvert, isPending } = useMutation({
    mutationFn: (payload: { paymentMethod: string; mpesaTransactionId?: string; mpesaReceiptNumber?: string }) =>
      convertQuotation(quotationId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast({ type: 'success', message: 'Quotation converted to a sale.' });
      // The Quotations list (Task 19) lives at this same basePath.
      router.replace(basePath as never);
    },
    onError: (error) => {
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not convert this quotation.') });
    },
  });

  const openCreditSummary = async () => {
    if (!quotation) return;
    setCreditSummaryVisible(true);
    setCreditAccount(null);
    setCreditSummaryError(null);
    setCreditSummaryLoading(true);
    try {
      const res = await getCustomerById(quotation.customer);
      if (!res.data.account) {
        // Server-side permission changed under the user mid-flow, or the
        // account response is malformed — either way, nothing to confirm.
        setCreditSummaryError('This account can no longer be checked. Pick the customer again.');
        return;
      }
      setCreditAccount(res.data.account);
    } catch {
      setCreditSummaryError('Could not check this customer\'s account. Check your connection and try again.');
    } finally {
      setCreditSummaryLoading(false);
    }
  };

  const confirmCreditSale = () => {
    setCreditSummaryVisible(false);
    submitConvert({ paymentMethod: CREDIT_METHOD_KEY });
  };

  const handleConvert = () => {
    if (!activeMethod || !quotation) return;
    if (activeMethod === MPESA_METHOD_KEY && mpesaEnabled) {
      if (!isValidKenyanPhone(quotation.customerSnapshot.phone ?? '')) {
        toast({ type: 'error', message: 'This customer has no valid M-Pesa number on file.' });
        return;
      }
      setMpesaVisible(true);
      return;
    }
    if (activeMethod === CREDIT_METHOD_KEY) {
      openCreditSummary();
      return;
    }
    // Everything else — cash, an unconfigured M-Pesa, or any other
    // shop-defined button — records directly, same as the till.
    submitConvert({ paymentMethod: activeMethod });
  };

  const handleMpesaSuccess = (transactionId: string | null, mpesaReceiptNumber: string | null) => {
    setMpesaVisible(false);
    submitConvert({
      paymentMethod: MPESA_METHOD_KEY,
      mpesaTransactionId: transactionId ?? undefined,
      mpesaReceiptNumber: mpesaReceiptNumber ?? undefined,
    });
  };

  if (!canConvert) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.restrictedText}>You do not have permission to convert quotations.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Convert to Sale" />

      {isLoading ? (
        <ListSkeleton rows={3} showSearch={false} />
      ) : isError ? (
        <QueryError onRetry={refetch} />
      ) : !quotation ? (
        <EmptyState
          title="Quotation not found"
          subtitle="It may have been deleted."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      ) : quotation.status !== 'draft' ? (
        <EmptyState
          title={quotation.status === 'converted' ? 'Already converted' : 'Quotation declined'}
          subtitle={
            quotation.status === 'converted'
              ? 'This quotation has already been turned into a sale.'
              : 'A declined quotation can no longer be converted.'
          }
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.xl }]}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.quoteNumber}>{quotation.quoteNumber}</Text>
            <Text style={styles.customerName} numberOfLines={1}>{quotation.customerSnapshot.name}</Text>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(quotation.total, currency)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>How is the customer paying?</Text>
          <View style={styles.methodList} accessibilityRole="radiogroup">
            {methods.map((m) => {
              const selected = activeMethod === m.key;
              return (
                <AnimatedPressable
                  key={m.key}
                  style={[styles.methodRow, selected && styles.methodRowSelected]}
                  onPress={() => { haptics.light(); setSelectedMethod(m.key); }}
                  disabled={isPending}
                  // "button" + selected, never "radio": RNGH-backed pressables
                  // never fire on web under input-like roles.
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Pay with ${m.label}`}
                >
                  <Ionicons
                    name={selected ? 'checkmark-circle' : (methodIcon(m) as never)}
                    size={20}
                    color={selected ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.methodLabel, selected && styles.methodLabelSelected]} numberOfLines={1}>
                    {m.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>

          <Button
            title="Convert to Sale"
            onPress={handleConvert}
            loading={isPending}
            disabled={isPending || !activeMethod}
            style={styles.convertBtn}
          />
        </ScrollView>
      )}

      {quotation && (
        <>
          <MpesaPaymentModal
            visible={mpesaVisible}
            phoneNumber={quotation.customerSnapshot.phone || ''}
            amount={quotation.total}
            accountReference={quotation.quoteNumber}
            currency={currency}
            onCancel={() => setMpesaVisible(false)}
            onSuccess={handleMpesaSuccess}
          />

          <CreditSummarySheet
            visible={creditSummaryVisible}
            onClose={() => setCreditSummaryVisible(false)}
            onConfirm={confirmCreditSale}
            customerName={quotation.customerSnapshot.name}
            account={creditAccount}
            saleAmount={quotation.total}
            currency={currency}
            loading={creditSummaryLoading}
            error={creditSummaryError}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.background },
  restrictedText: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: Typography.size.body, textAlign: 'center' },

  content: { padding: Spacing.lg },

  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  quoteNumber: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary },
  customerName: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  totalValue: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },

  sectionTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },

  methodList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  methodRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySubtle },
  methodLabel: { fontSize: Typography.size.body, fontFamily: Typography.fontFamily, color: Colors.textPrimary, flexShrink: 1 },
  methodLabelSelected: { fontFamily: Typography.fontFamilySemiBold, color: Colors.primary },

  convertBtn: { marginTop: Spacing.xs },
});
