import api from './api';

// Everything on the pricing/activation screens comes from these endpoints —
// prices, trial length, marketing copy, promo discounts. Nothing is
// hardcoded in the app, so plans can change without an app release.

export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';
export type AccessState = 'none' | 'trialing' | 'active' | 'grace' | 'locked';
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled' | 'timeout';

export interface PlanPricing {
  monthlyTotal: number;
  yearlyTotal: number;
  yearlySavings: number;
}

export interface SubscriptionPlan {
  _id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  billingType: 'per_staff' | 'flat';
  monthlyPrice: number;
  yearlyDiscountPercent: number;
  maxStaff: number;
  extraStaffPrice: number;
  trialDays: number;
  currency: string;
  highlights: string[];
  features: string[];
  badge: string;
  priceComparison: string;
  pricing: PlanPricing;
  recommended: boolean;
  /** Per-tier AI chat quotas — null (or a missing field, on older plans) means unlimited. */
  chatLimits?: {
    maxConversations: number | null;
    maxNewConversationsPerDay: number | null;
    maxMessagesPerDay: number | null;
  };
}

export interface PlansResponse {
  success: boolean;
  data: {
    plans: SubscriptionPlan[];
    staffCount: number;
    recommendedPlanSlug: string | null;
    currency: string;
    trialDays: number;
    yearlyOffer: { title: string; perks: string[] };
    launchOffer: { title: string; headline: string; note: string };
    providers: { key: string; label: string; available: boolean }[];
    hasSubscription: boolean;
  };
}

export interface Subscription {
  _id: string;
  shop: string;
  plan: SubscriptionPlan | string | null;
  status: SubscriptionStatus;
  trialStart: string | null;
  trialEnd: string | null;
  billingCycle: BillingCycle;
  currentPeriodEnd: string | null;
  staffCount: number;
  amountPaid: number;
  currency: string;
  paymentProvider: string | null;
  paymentReference: string | null;
  cancelledAt: string | null;
}

export interface SubscriptionAccess {
  state: AccessState;
  daysLeft: number;
  graceDaysLeft: number;
  expiresAt: string | null;
  cancelled: boolean;
}

export interface MySubscriptionResponse {
  success: boolean;
  data: {
    subscription: Subscription | null;
    access: SubscriptionAccess;
    gracePeriodDays: number;
    renewal: {
      planSlug: string;
      billingCycle: BillingCycle;
      amountDue: number;
      staffCount: number;
      currency: string;
    } | null;
  };
}

export interface PricingPreview {
  planSlug: string;
  planName: string;
  staffCount: number;
  billingCycle: BillingCycle;
  monthlyTotal: number;
  yearlyTotal: number;
  yearlySavings: number;
  promoDiscount: number;
  amountDue: number;
  currency: string;
}

export interface SubscriptionPaymentState {
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  receipt: string | null;
  periodEnd: string | null;
  errorMessage: string | null;
}

export async function getPlans(): Promise<PlansResponse> {
  const res = await api.get('/subscriptions/plans');
  return res.data;
}

export async function getMySubscription(): Promise<MySubscriptionResponse> {
  const res = await api.get('/subscriptions/me');
  return res.data;
}

export async function activateTrial(params?: {
  planSlug?: string;
  billingCycle?: BillingCycle;
}): Promise<{ success: boolean; data: { subscription: Subscription; alreadyActivated: boolean }; message: string }> {
  const res = await api.post('/subscriptions/trial', params ?? {});
  return res.data;
}

export async function previewPricing(params: {
  staffCount?: number;
  billingCycle?: BillingCycle;
  planSlug?: string;
  promoCode?: string;
}): Promise<{ success: boolean; data: PricingPreview }> {
  const res = await api.get('/subscriptions/preview', { params });
  return res.data;
}

export async function validatePromo(code: string): Promise<{
  success: boolean;
  data: { code: string; title: string; description: string; discountType: 'percentage' | 'fixed'; discountValue: number };
}> {
  const res = await api.post('/subscriptions/promo/validate', { code });
  return res.data;
}

/** Starts an M-PESA STK Push for the server-computed amount. */
export async function initiateSubscriptionPayment(
  params: { phoneNumber: string; billingCycle: BillingCycle; planSlug?: string; promoCode?: string },
  idempotencyKey?: string
): Promise<{ success: boolean; idempotent?: boolean; data: { paymentId: string; status: PaymentStatus; amount: number; currency: string }; message: string }> {
  const res = await api.post(
    '/subscriptions/pay',
    params,
    idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined
  );
  return res.data;
}

export async function getSubscriptionPaymentStatus(
  paymentId: string
): Promise<{ success: boolean; data: SubscriptionPaymentState }> {
  const res = await api.get(`/subscriptions/pay/${paymentId}`);
  return res.data;
}

/** Re-verifies a specific payment directly against M-PESA — "I definitely paid, check again." */
export async function recheckSubscriptionPayment(
  paymentId: string
): Promise<{ success: boolean; data: SubscriptionPaymentState }> {
  const res = await api.post(`/subscriptions/pay/${paymentId}/recheck`);
  return res.data;
}

/** Recovery path: the owner pastes their M-PESA confirmation SMS to unblock a payment that never activated. */
export async function reconcileSubscriptionByMessage(
  message: string
): Promise<{ success: boolean; data: SubscriptionPaymentState; message: string }> {
  const res = await api.post('/subscriptions/reconcile', { message });
  return res.data;
}

export async function cancelSubscription(): Promise<{ success: boolean; data: { subscription: Subscription }; message: string }> {
  const res = await api.post('/subscriptions/cancel');
  return res.data;
}
