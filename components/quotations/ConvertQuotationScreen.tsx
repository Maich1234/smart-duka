import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { usePendingQuotationMpesaStore, type PendingQuotationMpesaPayment } from '@/store/pendingQuotationMpesaStore';
import { getQuotations, convertQuotation } from '@/services/quotations';
import { getCustomerById, type CreditAccount } from '@/services/customers';
import { getPaymentStatus } from '@/services/paymentConfig';
import { getTransactionStatus } from '@/services/mpesa';
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

// Same values PosScreen.tsx uses for its own pending-payment background
// watch — how long, and how often, to keep quietly re-checking a payment
// the cashier hasn't come back to the banner for.
const BACKGROUND_WATCH_INTERVAL_MS = 10000;
const MAX_BACKGROUND_WATCH_MS = 5 * 60 * 1000;

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
  const shopId = useAuthStore((s) => s.user?.shop?._id) ?? '';
  const { toast, alert } = useAlert();
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
  // Mirrors mpesaModalVisibleRef in PosScreen.tsx: checkPendingPayment's
  // `.then()` can resolve after the modal has since been opened and is
  // already polling this same transaction itself — the ref (not the state
  // closed over when the callback was created) is what tells it to stand
  // down instead of firing a second, conflicting outcome.
  const mpesaVisibleRef = useRef(mpesaVisible);
  useEffect(() => { mpesaVisibleRef.current = mpesaVisible; }, [mpesaVisible]);
  // Set only when reopening the modal against an already-sent STK push (via
  // the recovery banner's "Check" button) — never on a fresh checkout tap.
  const [resumePayment, setResumePayment] = useState<PendingQuotationMpesaPayment | null>(null);
  // A payment still genuinely pending — the customer may complete it any
  // moment — surfaced as a banner rather than auto-reopening the modal, so
  // landing on this screen never pops a payment prompt the user didn't ask for.
  const [pendingBanner, setPendingBanner] = useState<PendingQuotationMpesaPayment | null>(null);

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

  // ── M-Pesa pending-payment recovery ─────────────────────────────────────
  // An STK push sent from this screen and then left mid-flight — the app was
  // backgrounded and later killed before it resolved — must never be
  // silently forgotten: the customer may have completed it, and forgetting
  // it is how a cashier ends up retrying and charging them twice. This
  // mirrors PosScreen's own checkPendingPayment/mount-recovery/background-
  // watch trio exactly, against the sibling pendingQuotationMpesaStore
  // (never the till's own store — a record from either could otherwise be
  // misread as the other's).
  const checkPendingPayment = React.useCallback((payment: PendingQuotationMpesaPayment) => {
    return getTransactionStatus(payment.transactionId)
      .then((res) => {
        // The modal can already be open and polling this same transaction
        // itself (reopened via the banner's "Check" button) by the time this
        // resolves — acting here too would pop a second, conflicting outcome
        // on top of it.
        if (mpesaVisibleRef.current) return;
        const s = res.data.status;
        if (s === 'success') {
          setPendingBanner(null);
          alert({
            type: 'confirm',
            title: 'M-Pesa Payment Confirmed',
            message: `A payment of ${formatCurrency(payment.amount, currency)} from ${payment.phoneNumber} has gone through. Record this sale now?`,
            buttons: [
              { label: 'Already recorded', variant: 'ghost', onPress: () => usePendingQuotationMpesaStore.getState().clear() },
              {
                label: 'Record Sale',
                onPress: () => {
                  usePendingQuotationMpesaStore.getState().clear();
                  submitConvert({ paymentMethod: MPESA_METHOD_KEY, mpesaTransactionId: payment.transactionId });
                },
              },
            ],
          });
        } else if (s === 'pending') {
          setPendingBanner(payment);
        } else {
          // failed / cancelled / timeout — nothing was charged, safe to drop.
          usePendingQuotationMpesaStore.getState().clear();
          setPendingBanner(null);
          toast({
            type: 'info',
            message: `A pending M-Pesa payment of ${formatCurrency(payment.amount, currency)} to ${payment.phoneNumber} did not complete.`,
          });
        }
      })
      .catch(() => {
        // No connection right now — keep watching/showing the banner rather
        // than guessing either way.
        setPendingBanner(payment);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  // Recover a payment left mid-flight by a previous app session. Runs once
  // this screen knows which shop and which quotation it's for.
  useEffect(() => {
    if (!shopId || !quotationId) return;
    const payment = usePendingQuotationMpesaStore.getState().payment;
    if (!payment) return;
    if (payment.shopId !== shopId) {
      // Stale record from a different shop/login — never ask about money
      // that isn't this shop's to begin with.
      usePendingQuotationMpesaStore.getState().clear();
      return;
    }
    if (payment.quotationId !== quotationId) {
      // Belongs to a different quotation's convert screen — leave it alone
      // for that screen to find; clearing it here would drop the one record
      // of a payment that screen still needs to reconcile.
      return;
    }
    checkPendingPayment(payment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, quotationId]);

  // A payment the user cancelled out of (or that mount-time recovery found)
  // while it was still genuinely pending. Re-checks quietly in the
  // background so a payment the customer completes moments later is caught
  // without anyone needing to notice the banner and tap it — capped so this
  // screen doesn't poll forever for a payment that's simply never coming.
  // Pauses while the modal itself is open so the two don't poll the same
  // transaction at once.
  useEffect(() => {
    if (!pendingBanner || mpesaVisible) return;
    const remaining = MAX_BACKGROUND_WATCH_MS - (Date.now() - new Date(pendingBanner.createdAt).getTime());
    if (remaining <= 0) return;

    const intervalId = setInterval(() => checkPendingPayment(pendingBanner), BACKGROUND_WATCH_INTERVAL_MS);
    const timeoutId = setTimeout(() => clearInterval(intervalId), remaining);
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [pendingBanner, mpesaVisible, checkPendingPayment]);

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
    setResumePayment(null);
    usePendingQuotationMpesaStore.getState().clear();
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

      {pendingBanner && (
        <View style={styles.recoveryBanner}>
          <Ionicons name="time-outline" size={16} color={Colors.warning} />
          <Text style={styles.recoveryBannerText}>
            M-Pesa payment of {formatCurrency(pendingBanner.amount, currency)} to{' '}
            {pendingBanner.phoneNumber} is still awaiting confirmation.
          </Text>
          <AnimatedPressable
            onPress={() => {
              setResumePayment(pendingBanner);
              setPendingBanner(null);
              setMpesaVisible(true);
            }}
            style={styles.recoveryBannerBtn}
            accessibilityRole="button"
            accessibilityLabel="Check M-Pesa payment status"
          >
            <Text style={styles.recoveryBannerBtnText}>Check</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => setPendingBanner(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Ionicons name="close" size={16} color={Colors.textTertiary} />
          </AnimatedPressable>
        </View>
      )}

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

      {/*
        Rendered unconditionally on `quotation` (unlike CreditSummarySheet
        below) — the recovery banner's "Check" button must still be able to
        reopen this and resolve a pending payment even if the quotation
        itself somehow failed to load (or was deleted elsewhere) in the
        meantime. Money-safety here depends only on the persisted payment
        record, never on the quotation record still being fetchable.
      */}
      <MpesaPaymentModal
        visible={mpesaVisible}
        phoneNumber={resumePayment?.phoneNumber ?? quotation?.customerSnapshot.phone ?? ''}
        amount={resumePayment?.amount ?? quotation?.total ?? 0}
        accountReference={quotation?.quoteNumber}
        currency={currency}
        onCancel={() => {
          setMpesaVisible(false);
          // Closing the modal stops its polling outright (it unmounts). If
          // the transaction never got a chance to resolve on its own, don't
          // just drop it — surface the banner immediately and let the
          // background watcher keep checking.
          const stillOpen = usePendingQuotationMpesaStore.getState().payment;
          if (stillOpen && stillOpen.quotationId === quotationId) setPendingBanner(stillOpen);
          setResumePayment(null);
        }}
        onSuccess={handleMpesaSuccess}
        onResolved={() => {
          // Polling itself determined this is dead — nothing left to watch.
          usePendingQuotationMpesaStore.getState().clear();
          setPendingBanner(null);
        }}
        resumeTransactionId={resumePayment?.transactionId}
        onInitiated={
          resumePayment
            ? undefined
            : (transactionId) => {
                if (!shopId || !quotation) return;
                usePendingQuotationMpesaStore.getState().set({
                  quotationId,
                  transactionId,
                  shopId,
                  phoneNumber: quotation.customerSnapshot.phone || '',
                  amount: quotation.total,
                  createdAt: new Date().toISOString(),
                });
              }
        }
      />

      {quotation && (
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

  recoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.warningSubtle,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
  },
  recoveryBannerText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  recoveryBannerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.warning,
  },
  recoveryBannerBtnText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.white,
  },
});
