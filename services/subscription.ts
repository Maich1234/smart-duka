import api from './api';

// Everything on the pricing/activation screens comes from these endpoints —
// prices, trial length, marketing copy, promo discounts. Nothing is
// hardcoded in the app, so plans can change without an app release.

export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';
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

/**
 * Starts the free trial. Takes no plan or cycle — the server picks the tier
 * that fits the shop's head-count, and plan choice belongs with payment.
 */
export async function activateTrial(): Promise<{
  success: boolean;
  data: { subscription: Subscription; alreadyActivated: boolean };
  message: string;
}> {
  const res = await api.post('/subscriptions/trial', {});
  return res.data;
}

export async function cancelSubscription(): Promise<{ success: boolean; data: { subscription: Subscription }; message: string }> {
  const res = await api.post('/subscriptions/cancel');
  return res.data;
}

/**
 * Re-sends the renewal link via push + email — the same two channels the
 * reminder cron uses. This is the paywall's "Resend payment link" action for
 * an owner who dismissed or can't find the original notification. Compliant
 * with the no-purchase-surface rule below: it never returns or opens a URL
 * itself, it only asks the backend to dispatch one through channels outside
 * the app binary.
 */
export async function resendRenewalLink(): Promise<{ success: boolean; message: string; emailSent?: boolean }> {
  const res = await api.post('/subscriptions/resend-link');
  return res.data;
}

// NOTE: there is deliberately no pricing preview, promo validation, payment
// initiation, payment polling, or payment reconciliation in this file.
//
// Google Play requires Play Billing for in-app purchases that unlock app
// functionality, and its anti-steering rules also forbid linking users to an
// external checkout from inside the app. So the app binary contains no
// purchase surface at all: those endpoints exist on the backend and are
// consumed only by the web app. Re-adding any of them here would put the
// Play listing at risk of removal, not just rejection.
