# Loyalty Program — Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an owner configure Points and Purchase-Frequency loyalty, and let a cashier attach a customer to any sale, see that customer's loyalty status at checkout, and redeem a reward — against the backend built in `smart-duka-backend`'s `docs/superpowers/plans/2026-09-16-loyalty-program-backend.md`.

**Architecture:** New `services/loyalty.ts` + extensions to `services/customers.ts`/`services/shop.ts`/`services/sales.ts` for the API contract; a generalized "attached customer" concept in the till (today's `creditCustomer` cart-store field stays untouched and credit-only — a new, separate `attachedCustomer` field covers the non-credit case); a `Loyalty` owner settings screen peer to `settings/credit.tsx`; a compact checkout chip + redeem sheet, mirroring `CreditSummarySheet`; a Loyalty section on `CustomerAccountScreen`. No new navigation shape, no new design system — `ScreenHeader`, `BottomSheet`, `SettingsCard`/`SettingsRow`, `AnimatedPressable`, and the existing color/spacing/motion tokens throughout, exactly as the Credit screens already established.

**Tech Stack:** Expo Router, React Native, TypeScript, `@tanstack/react-query`, Zustand (`staffCartStore`), Jest.

**Spec:** `docs/customer-credit-loyalty.md` (§2 Loyalty Program) in this repo. The backend plan (`smart-duka-backend/docs/superpowers/plans/2026-09-16-loyalty-program-backend.md`) is the authoritative source for every request/response shape used below — read its Tasks 6, 8, 10, 11 before starting.

## Global Constraints

- Redemption requests are realtime-only (`{ realtimeOnly: true }` on the `api` call) — never queued offline, exactly like a credit sale, because the balance/count it's checked against lives on the server.
- Earning requests are ordinary sales and go through the existing offline-first path unchanged — no new offline handling needed anywhere in this plan.
- No mobile UI for per-product `loyaltyPointsEligible`/`loyaltyFrequencyEligible` toggles in this plan — the analogous `creditEligible` flag has no mobile toggle either (grep-confirmed: it exists only on the backend Product model, unused by any current app screen). Matching that precedent, `SELECTED_PRODUCTS` stays a backend-only-configurable policy for now; ship `ALL_PRODUCTS` as the fully-supported default in every screen built here.
- Match the existing hand-rolled settings pattern (`SettingsCard`/`SettingsRow`/`Switch`/`AnimatedPressable`) used by `app/(owner)/settings/credit.tsx`, not `@expo/ui` — this screen sits directly beside Credit's and every other settings screen in this app already uses this pattern; introducing a different component library for one adjacent screen would be the inconsistency, not the fix.
- No web work — `smart-duka-web` is explicitly out of scope (see spec §3).

---

### Task 1: `services/loyalty.ts` and the `Shop`/`UpdateShopConfigData` extension

**Files:**
- Create: `services/loyalty.ts`
- Modify: `services/shop.ts`

**Interfaces:**
- Produces: `LoyaltyRewardType`, `LoyaltyProductPolicy`, `LoyaltyPointsSettings`, `LoyaltyFrequencySettings`, `LoyaltySettings`, `LoyaltyAccountSummary`, `LoyaltyTransactionType`, `LoyaltyTransaction`, `reverseLoyaltyTransaction(transactionId, reason)` — imported by every later task; `Shop.loyaltySettings`, `UpdateShopConfigData.loyaltySettings` — used by Task 4 (settings screen).

- [ ] **Step 1: Write `services/loyalty.ts`**

```ts
// services/loyalty.ts
import api from './api';

/**
 * Loyalty types and the one standalone loyalty endpoint (a manual owner
 * correction). Settings live on services/shop.ts (merge-patched through the
 * shop config endpoint, like creditSettings); earning and redemption ride
 * services/sales.ts's createSale — see its `loyaltyRedemption` field.
 */

export type LoyaltyRewardType = 'PERCENTAGE_DISCOUNT' | 'FIXED_DISCOUNT' | 'FREE_ITEM';
export type LoyaltyProductPolicy = 'ALL_PRODUCTS' | 'SELECTED_PRODUCTS';

export interface LoyaltyPointsRedemptionSettings {
  rewardType: LoyaltyRewardType;
  /** Points required per reward unit. Doubles as the points-per-KES ratio
   * for FIXED_DISCOUNT, where a customer may redeem any amount up to their
   * balance; PERCENTAGE_DISCOUNT/FREE_ITEM must redeem exactly this many. */
  pointsCost: number;
  /** KES off per pointsCost (FIXED_DISCOUNT) or percent off (PERCENTAGE_DISCOUNT). Ignored for FREE_ITEM. */
  rewardValue: number;
  /** Required when rewardType is FREE_ITEM. */
  rewardProductId: string | null;
  minPointsToRedeem: number;
}

export interface LoyaltyPointsSettings {
  enabled: boolean;
  /** KES spent (on eligible items) per 1 point earned. */
  earnRatePerKes: number;
  productPolicy: LoyaltyProductPolicy;
  redemption: LoyaltyPointsRedemptionSettings;
}

export interface LoyaltyFrequencyRewardSettings {
  rewardType: LoyaltyRewardType;
  rewardValue: number;
  rewardProductId: string | null;
}

export interface LoyaltyFrequencySettings {
  enabled: boolean;
  /** "Buy 9 times, get the 10th..." -> purchasesRequired = 10. */
  purchasesRequired: number;
  productPolicy: LoyaltyProductPolicy;
  reward: LoyaltyFrequencyRewardSettings;
}

export interface LoyaltySettings {
  points: LoyaltyPointsSettings;
  frequency: LoyaltyFrequencySettings;
}

/** Server-computed. Never derived on the device. */
export interface LoyaltyAccountSummary {
  points: {
    enabled: boolean;
    balance: number;
    lifetimeEarned: number;
    lifetimeRedeemed: number;
    redemption: LoyaltyPointsRedemptionSettings;
  };
  frequency: {
    enabled: boolean;
    count: number;
    purchasesRequired: number;
    rewardsRedeemed: number;
    reward: LoyaltyFrequencyRewardSettings;
  };
  lastEarnedAt: string | null;
  lastRedeemedAt: string | null;
}

export type LoyaltyTransactionType =
  | 'POINTS_EARNED'
  | 'POINTS_REDEEMED'
  | 'POINTS_EARNED_REVERSED'
  | 'POINTS_REDEEMED_REVERSED'
  | 'FREQUENCY_PROGRESS'
  | 'FREQUENCY_PROGRESS_REVERSED'
  | 'FREQUENCY_REWARD_REDEEMED'
  | 'FREQUENCY_REWARD_REVERSED';

export interface LoyaltyRewardApplied {
  rewardType: LoyaltyRewardType;
  rewardValue: number;
  rewardProductId: string | null;
  discountAmount: number;
}

export interface LoyaltyTransaction {
  _id: string;
  type: LoyaltyTransactionType;
  program: 'POINTS' | 'FREQUENCY';
  points?: number;
  pointsBalanceAfter?: number;
  frequencyCountAfter?: number;
  rewardApplied?: LoyaltyRewardApplied;
  sale?: string;
  reversalOf?: string | null;
  reversedBy?: string | null;
  reason?: string;
  staffName?: string;
  createdAt: string;
}

/**
 * Owner only. Manual correction for an earn/redemption entered in error —
 * automatic reversal on void/refund needs no client call, the backend does
 * it. Writes a compensating entry; the original stays in the history.
 */
export const reverseLoyaltyTransaction = async (
  transactionId: string,
  reason: string
): Promise<{ success: boolean; data: { transaction: LoyaltyTransaction }; message: string }> => {
  const res = await api.post(
    `/loyalty/transactions/${transactionId}/reverse`,
    { reason },
    { realtimeOnly: true }
  );
  return res.data;
};
```

- [ ] **Step 2: Extend `services/shop.ts`**

Add the import:

```ts
import type { LoyaltySettings } from './loyalty';
```

Add to the `Shop` interface, alongside the existing `creditSettings?: CreditSettings;`:

```ts
  /** Points + purchase-frequency loyalty. Absent on shops that predate the
   * module — the backend resolves defaults, so an absent value means the
   * response itself is stale, not that loyalty is unconfigured. Read it as
   * off either way. */
  loyaltySettings?: LoyaltySettings;
```

Add to `UpdateShopConfigData`, alongside `creditSettings?: Partial<CreditSettings>;`:

```ts
  /** Merged server-side per program, so one field can be written without resending the rest. */
  loyaltySettings?: { points?: Partial<LoyaltyPointsSettings>; frequency?: Partial<LoyaltyFrequencySettings> };
```

(This needs `LoyaltyPointsSettings`/`LoyaltyFrequencySettings` imported too — add them to the same `import type` line as `LoyaltySettings`.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 4: Commit**

```bash
git add services/loyalty.ts services/shop.ts
git commit -m "Add loyalty service types and shop config extension"
```

---

### Task 2: Extend `services/customers.ts`

**Files:**
- Modify: `services/customers.ts`

**Interfaces:**
- Consumes: `LoyaltyAccountSummary`, `LoyaltyTransaction` (Task 1).
- Produces: `CustomerDetail.loyalty`, `CustomerDetail.loyaltyTransactions`, `CustomerDetail.loyaltyPagination` — consumed by Task 9 (`CustomerAccountScreen`).

- [ ] **Step 1: Add the import and extend `CustomerDetail`**

Add:

```ts
import type { LoyaltyAccountSummary, LoyaltyTransaction } from './loyalty';
```

Extend the `CustomerDetail` interface:

```ts
export interface CustomerDetail extends Customer {
  transactions: CreditTransaction[];
  recentSales: CustomerSaleSummary[];
  /** Server-computed loyalty summary. Null for a viewer without permission to see credit/loyalty. */
  loyalty: LoyaltyAccountSummary | null;
  loyaltyTransactions: LoyaltyTransaction[];
  loyaltyPagination?: { page: number; limit: number; total: number; pages: number };
  /** True when the timeline is only this user's own entries — say so in the UI. */
  scopedToSelf: boolean;
  pagination?: { page: number; limit: number; total: number; pages: number };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add services/customers.ts
git commit -m "Add loyalty fields to CustomerDetail"
```

---

### Task 3: Extend `services/sales.ts`

**Files:**
- Modify: `services/sales.ts`
- Test: `__tests__/services/sales.test.ts`

**Interfaces:**
- Consumes: `LoyaltyAccountSummary` (Task 1).
- Produces: `CreateSaleData.loyaltyRedemption`, `Sale.loyalty` — used by Task 8 (`PosScreen`).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/services/sales.test.ts
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import api from '@/services/api';
import { createSale } from '@/services/sales';
import { resetAllTestState } from '../testUtils';

const mock = new MockAdapter(api);

describe('services/sales createSale', () => {
  beforeEach(() => {
    resetAllTestState();
    mock.reset();
  });
  afterAll(() => mock.restore());

  it('marks a loyalty-redemption sale realtimeOnly, same as a credit sale', async () => {
    mock.onPost('/sales').reply((config) => {
      expect(config.realtimeOnly).toBe(true);
      return [201, { success: true, data: {} }];
    });

    await createSale({
      items: [{ productId: 'p1', quantity: 1 }],
      paymentMethod: 'cash',
      customerId: 'cust1',
      loyaltyRedemption: { program: 'POINTS', pointsRedeemed: 30 },
    });
  });

  it('an ordinary cash sale with no redemption is not realtimeOnly', async () => {
    mock.onPost('/sales').reply((config) => {
      expect(config.realtimeOnly).toBeFalsy();
      return [201, { success: true, data: {} }];
    });

    await createSale({ items: [{ productId: 'p1', quantity: 1 }], paymentMethod: 'cash' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/services/sales.test.ts`
Expected: FAIL — `loyaltyRedemption` is not a known property of `CreateSaleData` (TS) and `realtimeOnly` stays `false` for the first case

- [ ] **Step 3: Extend `CreateSaleData`, `Sale`, and `createSale`**

Add the import:

```ts
import type { LoyaltyAccountSummary } from './loyalty';
```

Extend `CreateSaleData`, alongside the existing `customerId?: string;`:

```ts
  /**
   * A reward the cashier chose to apply on this sale. Optional, and only
   * meaningful with `customerId` set. Realtime-only on the client (see
   * createSale below), exactly like a credit sale — the balance/count it's
   * checked against lives on the server.
   */
  loyaltyRedemption?: {
    program: 'POINTS' | 'FREQUENCY';
    /** POINTS only. Required for a FIXED_DISCOUNT reward; for the other two
     * reward types the server requires it equal the program's pointsCost. */
    pointsRedeemed?: number;
  };
```

Extend `Sale`, alongside the existing `credit?: {...}` field:

```ts
  /** Present only on a createSale response when the sale earned and/or
   * redeemed loyalty. Server-computed, so the client displays it rather
   * than deriving it. */
  loyalty?: {
    account: LoyaltyAccountSummary;
    redemption?: { transactionId: string; discountAmount: number };
  };
```

Change `createSale`'s `realtimeOnly` flag:

```ts
export const createSale = async (data: CreateSaleData): Promise<SaleResponse> => {
  const response = await api.post('/sales', data, {
    realtimeOnly: data.paymentMethod === CREDIT_METHOD_KEY || !!data.loyaltyRedemption,
  });
  return response.data;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/services/sales.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add services/sales.ts __tests__/services/sales.test.ts
git commit -m "Wire loyaltyRedemption through createSale, realtime-only"
```

---

### Task 4: `attachedCustomer` cart-store field

**Files:**
- Modify: `store/staffCartStore.ts`

**Interfaces:**
- Produces: `CartStore.attachedCustomer`, `CartStore.setAttachedCustomer` — used by Task 8 (`PosScreen`), Task 7 (`CartSummary`).

A new, separate field from `creditCustomer` — deliberately not a rename or a shared field, so the already-shipped, already-tested credit checkout path is untouched. `attachedCustomer` is the "optionally attach a regular for loyalty" case on any non-credit payment method.

- [ ] **Step 1: Add the field**

In `store/staffCartStore.ts`, add to the `CartStore` interface, alongside the existing `creditCustomer`/`setCreditCustomer`:

```ts
  /**
   * A customer attached to a non-credit sale so they earn loyalty — optional,
   * and deliberately separate from creditCustomer above (which is required
   * and payment-method-specific). Persisted for the same reason: an app kill
   * mid-sale must not silently drop who was about to earn. Cleared on every
   * completed sale and on Discard.
   */
  attachedCustomer: { _id: string; name: string } | null;
  setAttachedCustomer: (customer: { _id: string; name: string } | null) => void;
```

Add to the store implementation, alongside `creditCustomer`/`setCreditCustomer`:

```ts
      attachedCustomer: null,
      setAttachedCustomer: (customer) => set({ attachedCustomer: customer }),
```

Extend `resetSaleFields`:

```ts
      resetSaleFields: () => set({
        customerPhone: '', mpesaMode: 'stk', manualReceiptCode: '', creditCustomer: null, attachedCustomer: null,
      }),
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add store/staffCartStore.ts
git commit -m "Add attachedCustomer to the cart store for loyalty-only sales"
```

---

### Task 5: Loyalty settings screen

**Files:**
- Create: `app/(owner)/settings/loyalty.tsx`
- Modify: `app/(owner)/settings/pos-sales.tsx`

**Interfaces:**
- Consumes: `LoyaltySettings` (Task 1), `updateShopConfig` (`services/shop.ts`).

Mirrors `app/(owner)/settings/credit.tsx` field-for-field: same `patch-then-invalidate` pattern against the merge-not-replace shop config endpoint, same `SettingsCard`/`SettingsRow`/`Switch` components.

- [ ] **Step 1: Write the screen**

```tsx
// app/(owner)/settings/loyalty.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Input } from '@/components/ui/Input';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useShopConfig } from '@/hooks/useShopConfig';
import { useAlert } from '@/context/AlertContext';
import { updateShopConfig } from '@/services/shop';
import { useQueryClient } from '@tanstack/react-query';
import { SettingsCard, SettingsRow, SettingsRowDivider, SettingsSectionLabel } from '@/components/settings/SettingsRow';
import { mutationErrorMessage } from '@/utils/errors';
import type { LoyaltyPointsSettings, LoyaltyFrequencySettings } from '@/services/loyalty';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const REWARD_TYPE_LABEL: Record<string, string> = {
  PERCENTAGE_DISCOUNT: '% off',
  FIXED_DISCOUNT: 'KES off',
  FREE_ITEM: 'Free item',
};

/**
 * Points and Purchase-Frequency loyalty, two independently toggleable
 * sections. Every switch writes through the same merge-not-replace endpoint
 * (updateShopConfig with a partial `loyaltySettings`) that Customer Credit
 * already established — flipping one field never resets its siblings.
 */
export default function LoyaltySettingsScreen() {
  const tabBarHeight = useTabBarHeight();
  const { toast } = useAlert();
  const queryClient = useQueryClient();
  const { shopConfig, loadingShop } = useShopConfig();
  const points = shopConfig?.loyaltySettings?.points;
  const frequency = shopConfig?.loyaltySettings?.frequency;

  const [savingPointsEnabled, setSavingPointsEnabled] = useState(false);
  const [savingFrequencyEnabled, setSavingFrequencyEnabled] = useState(false);
  const [savingEarnRate, setSavingEarnRate] = useState(false);
  const [savingRedemptionValue, setSavingRedemptionValue] = useState(false);
  const [savingPurchasesRequired, setSavingPurchasesRequired] = useState(false);
  const [earnRateDraft, setEarnRateDraft] = useState<string | null>(null);
  const [redemptionValueDraft, setRedemptionValueDraft] = useState<string | null>(null);
  const [purchasesRequiredDraft, setPurchasesRequiredDraft] = useState<string | null>(null);

  const patchPoints = async (
    patch: Partial<LoyaltyPointsSettings>,
    setSaving: (v: boolean) => void,
    successMessage?: string,
  ) => {
    const previous = queryClient.getQueryData(['shopConfig']);
    queryClient.setQueryData(['shopConfig'], (old: any) =>
      old ? { ...old, data: { ...old.data, loyaltySettings: { ...old.data.loyaltySettings, points: { ...old.data.loyaltySettings?.points, ...patch } } } } : old);
    setSaving(true);
    try {
      await updateShopConfig({ loyaltySettings: { points: patch } });
      queryClient.invalidateQueries({ queryKey: ['shopConfig'] });
      if (successMessage) toast({ type: 'success', message: successMessage });
    } catch (error) {
      queryClient.setQueryData(['shopConfig'], previous);
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not update points settings') });
    } finally {
      setSaving(false);
    }
  };

  const patchFrequency = async (
    patch: Partial<LoyaltyFrequencySettings>,
    setSaving: (v: boolean) => void,
    successMessage?: string,
  ) => {
    const previous = queryClient.getQueryData(['shopConfig']);
    queryClient.setQueryData(['shopConfig'], (old: any) =>
      old ? { ...old, data: { ...old.data, loyaltySettings: { ...old.data.loyaltySettings, frequency: { ...old.data.loyaltySettings?.frequency, ...patch } } } } : old);
    setSaving(true);
    try {
      await updateShopConfig({ loyaltySettings: { frequency: patch } });
      queryClient.invalidateQueries({ queryKey: ['shopConfig'] });
      if (successMessage) toast({ type: 'success', message: successMessage });
    } catch (error) {
      queryClient.setQueryData(['shopConfig'], previous);
      toast({ type: 'error', message: mutationErrorMessage(error, 'Could not update frequency settings') });
    } finally {
      setSaving(false);
    }
  };

  if (loadingShop || !points || !frequency) {
    return <View style={styles.flex} />;
  }

  const earnRateText = earnRateDraft ?? String(points.earnRatePerKes);
  const redemptionValueText = redemptionValueDraft ?? String(points.redemption.rewardValue);
  const purchasesRequiredText = purchasesRequiredDraft ?? String(frequency.purchasesRequired);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.lg }}>
        <SettingsSectionLabel label="Reward customers for coming back." />

        {/* ── Points ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.duration(320)}>
          <SettingsCard>
            <SettingsRow
              icon="star-outline"
              iconColor={Colors.primary}
              iconBg={Colors.primarySubtle}
              title="Points"
              subtitle={points.enabled ? 'Customers earn points on every sale' : 'Off'}
              right={
                <Switch
                  value={points.enabled}
                  onValueChange={(enabled) => patchPoints({ enabled }, setSavingPointsEnabled, enabled ? 'Points are on' : 'Points are off')}
                  disabled={savingPointsEnabled}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={points.enabled ? Colors.primary : Colors.textTertiary}
                />
              }
            />
          </SettingsCard>
        </Animated.View>

        {points.enabled && (
          <>
            <SettingsSectionLabel label="How points are earned" />
            <Animated.View entering={FadeInUp.duration(320).delay(40)}>
              <SettingsCard>
                <Text style={styles.helperText}>KES a customer must spend to earn 1 point.</Text>
                <View style={styles.inlineRow}>
                  <Input
                    value={earnRateText}
                    onChangeText={(t) => setEarnRateDraft(t.replace(/[^0-9]/g, ''))}
                    onBlur={() => {
                      const value = Number.parseInt(earnRateText || '0', 10);
                      if (Number.isFinite(value) && value > 0) patchPoints({ earnRatePerKes: value }, setSavingEarnRate);
                      setEarnRateDraft(null);
                    }}
                    keyboardType="number-pad"
                    placeholder="100"
                    style={styles.smallInput}
                    accessibilityLabel="KES per point"
                  />
                  {savingEarnRate && <Text style={styles.savingHint}>Saving…</Text>}
                </View>
              </SettingsCard>
            </Animated.View>

            <SettingsSectionLabel label="How points are redeemed" />
            <Animated.View entering={FadeInUp.duration(320).delay(80)}>
              <SettingsCard>
                <View style={styles.presetRow}>
                  {(['FIXED_DISCOUNT', 'PERCENTAGE_DISCOUNT', 'FREE_ITEM'] as const).map((type) => {
                    const selected = points.redemption.rewardType === type;
                    return (
                      <AnimatedPressable
                        key={type}
                        onPress={() => patchPoints({ redemption: { ...points.redemption, rewardType: type } }, setSavingRedemptionValue)}
                        style={[styles.preset, selected && styles.presetSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.presetLabel, selected && styles.presetLabelSelected]}>{REWARD_TYPE_LABEL[type]}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
                {points.redemption.rewardType !== 'FREE_ITEM' && (
                  <View style={styles.inlineRow}>
                    <Text style={styles.helperText}>
                      {points.redemption.pointsCost} points ={' '}
                    </Text>
                    <Input
                      value={redemptionValueText}
                      onChangeText={(t) => setRedemptionValueDraft(t.replace(/[^0-9.]/g, ''))}
                      onBlur={() => {
                        const value = Number.parseFloat(redemptionValueText || '0');
                        if (Number.isFinite(value) && value >= 0) {
                          patchPoints({ redemption: { ...points.redemption, rewardValue: value } }, setSavingRedemptionValue);
                        }
                        setRedemptionValueDraft(null);
                      }}
                      keyboardType="decimal-pad"
                      style={styles.smallInput}
                      accessibilityLabel="Redemption value"
                    />
                    <Text style={styles.helperText}>
                      {points.redemption.rewardType === 'FIXED_DISCOUNT' ? 'KES off' : '% off'}
                    </Text>
                  </View>
                )}
                {points.redemption.rewardType === 'FREE_ITEM' && (
                  <Text style={styles.helperText}>
                    Set the free product from the customer picker on the till when this reward is configured — choosing it here is coming soon.
                  </Text>
                )}
              </SettingsCard>
            </Animated.View>
          </>
        )}

        {/* ── Frequency ──────────────────────────────────────────────── */}
        <SettingsSectionLabel label="Purchase frequency" />
        <Animated.View entering={FadeInUp.duration(320).delay(120)}>
          <SettingsCard>
            <SettingsRow
              icon="repeat-outline"
              iconColor={Colors.primary}
              iconBg={Colors.primarySubtle}
              title="Reward repeat visits"
              subtitle={frequency.enabled ? `Every ${frequency.purchasesRequired}th qualifying purchase` : 'Off'}
              right={
                <Switch
                  value={frequency.enabled}
                  onValueChange={(enabled) => patchFrequency({ enabled }, setSavingFrequencyEnabled, enabled ? 'Frequency reward is on' : 'Frequency reward is off')}
                  disabled={savingFrequencyEnabled}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={frequency.enabled ? Colors.primary : Colors.textTertiary}
                />
              }
            />
          </SettingsCard>
        </Animated.View>

        {frequency.enabled && (
          <>
            <SettingsSectionLabel label="Purchases needed" />
            <Animated.View entering={FadeInUp.duration(320).delay(160)}>
              <SettingsCard>
                <Text style={styles.helperText}>
                  e.g. 10 means the 10th qualifying purchase gets the reward.
                </Text>
                <View style={styles.inlineRow}>
                  <Input
                    value={purchasesRequiredText}
                    onChangeText={(t) => setPurchasesRequiredDraft(t.replace(/[^0-9]/g, ''))}
                    onBlur={() => {
                      const value = Number.parseInt(purchasesRequiredText || '0', 10);
                      if (Number.isFinite(value) && value >= 2) patchFrequency({ purchasesRequired: value }, setSavingPurchasesRequired);
                      setPurchasesRequiredDraft(null);
                    }}
                    keyboardType="number-pad"
                    placeholder="10"
                    style={styles.smallInput}
                    accessibilityLabel="Purchases required"
                  />
                  {savingPurchasesRequired && <Text style={styles.savingHint}>Saving…</Text>}
                </View>
              </SettingsCard>
            </Animated.View>

            <SettingsSectionLabel label="The reward" />
            <Animated.View entering={FadeInUp.duration(320).delay(200)}>
              <SettingsCard>
                <View style={styles.presetRow}>
                  {(['FREE_ITEM', 'PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT'] as const).map((type) => {
                    const selected = frequency.reward.rewardType === type;
                    return (
                      <AnimatedPressable
                        key={type}
                        onPress={() => patchFrequency({ reward: { ...frequency.reward, rewardType: type } }, setSavingRedemptionValue)}
                        style={[styles.preset, selected && styles.presetSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.presetLabel, selected && styles.presetLabelSelected]}>{REWARD_TYPE_LABEL[type]}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
                <Text style={styles.helperText}>
                  {frequency.reward.rewardType === 'FREE_ITEM'
                    ? 'Discounts one eligible item in the qualifying cart, free. Choose the exact product from the customer picker on the till.'
                    : 'Discounts the cheapest eligible item in the qualifying cart, unless a specific product is set from the till.'}
                </Text>
              </SettingsCard>
            </Animated.View>
          </>
        )}

        <SettingsSectionLabel label="Which products count" />
        <Animated.View entering={FadeInUp.duration(280)} style={styles.offNotice}>
          <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.offNoticeText}>
            Every product counts toward both Points and Frequency for now. Choosing specific products is coming soon.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  offNotice: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.divider,
  },
  offNoticeText: { flex: 1, fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  helperText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, marginBottom: Spacing.sm },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  smallInput: { width: 90 },
  savingHint: { fontSize: 11, color: Colors.textTertiary },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  preset: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minHeight: 40,
    justifyContent: 'center',
  },
  presetSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  presetLabel: { fontSize: 13, color: Colors.textSecondary, fontFamily: Typography.fontFamilySemiBold },
  presetLabelSelected: { color: Colors.white },
});
```

- [ ] **Step 2: Link it from the POS & Sales settings list**

In `app/(owner)/settings/pos-sales.tsx`, add a row immediately after the existing "Customer Credit" `SettingsRow`/`SettingsRowDivider` pair:

```tsx
            <SettingsRowDivider />
            <SettingsRow
              icon="star-outline"
              iconColor={Colors.primary}
              iconBg={Colors.primarySubtle}
              title="Customer Loyalty"
              subtitle="Points and repeat-visit rewards"
              onPress={() => router.push('/(owner)/settings/loyalty' as never)}
            />
```

- [ ] **Step 3: Run the app and verify the screen**

Run the dev server (`npx expo start`), sign in as an owner, navigate to Settings → POS & Sales → Customer Loyalty, toggle Points on, set an earn rate, toggle Frequency on, set purchases required, and confirm each write round-trips (pull to refresh / re-open the screen shows the saved value) without resetting sibling fields.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(owner)/settings/loyalty.tsx" "app/(owner)/settings/pos-sales.tsx"
git commit -m "Add the Loyalty settings screen"
```

---

### Task 6: `LoyaltyChip` and `LoyaltyRedeemSheet`

**Files:**
- Create: `components/loyalty/LoyaltyChip.tsx`
- Create: `components/loyalty/LoyaltyRedeemSheet.tsx`

**Interfaces:**
- Consumes: `LoyaltyAccountSummary` (Task 1).
- Produces: `LoyaltyChip` props `{ account, currency?, loading?, onRedeem }`; `LoyaltyRedeemSheet` props `{ visible, onClose, onConfirm, customerName, account, cartSubtotal, currency?, loading?, error? }` where `onConfirm: (redemption: { program: 'POINTS' | 'FREQUENCY'; pointsRedeemed?: number }) => void` — both consumed by Task 8 (`PosScreen`).

- [ ] **Step 1: Write `LoyaltyChip.tsx`**

A single-line, unobtrusive checkout row — not a card — showing whichever programs are enabled, with a "Redeem" pill that only appears when something is actually redeemable.

```tsx
// components/loyalty/LoyaltyChip.tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import type { LoyaltyAccountSummary } from '@/services/loyalty';

interface LoyaltyChipProps {
  account: LoyaltyAccountSummary | null;
  loading?: boolean;
  onRedeem: () => void;
}

/** Whether anything on this account can actually be redeemed right now. */
export const isLoyaltyRedeemable = (account: LoyaltyAccountSummary | null): boolean => {
  if (!account) return false;
  const pointsRedeemable = account.points.enabled
    && account.points.balance >= Math.max(account.points.redemption.minPointsToRedeem, account.points.redemption.pointsCost);
  const frequencyRedeemable = account.frequency.enabled
    && account.frequency.count + 1 >= account.frequency.purchasesRequired;
  return pointsRedeemable || frequencyRedeemable;
};

export const LoyaltyChip: React.FC<LoyaltyChipProps> = ({ account, loading = false, onRedeem }) => {
  if (loading) {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingText}>Checking loyalty…</Text>
      </View>
    );
  }
  if (!account || (!account.points.enabled && !account.frequency.enabled)) return null;

  const redeemable = isLoyaltyRedeemable(account);

  return (
    <View style={styles.row}>
      <Ionicons name="star" size={14} color={Colors.primary} />
      <Text style={styles.text} numberOfLines={1}>
        {account.points.enabled ? `${account.points.balance} pts` : null}
        {account.points.enabled && account.frequency.enabled ? '  ·  ' : null}
        {account.frequency.enabled ? `${account.frequency.count}/${account.frequency.purchasesRequired} visits` : null}
      </Text>
      {redeemable && (
        <AnimatedPressable
          onPress={onRedeem}
          style={styles.redeemPill}
          pressScale={0.97}
          accessibilityRole="button"
          accessibilityLabel="Redeem a loyalty reward"
        >
          <Text style={styles.redeemPillText}>Redeem</Text>
        </AnimatedPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  text: { flex: 1, fontSize: Typography.size.caption, color: Colors.textSecondary, fontFamily: Typography.fontFamilySemiBold },
  loadingText: { fontSize: Typography.size.caption, color: Colors.textSecondary },
  redeemPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.pill ?? 999,
    backgroundColor: Colors.primarySubtle,
  },
  redeemPillText: { fontSize: 11, fontFamily: Typography.fontFamilySemiBold, color: Colors.primary },
});
```

- [ ] **Step 2: Write `LoyaltyRedeemSheet.tsx`**

Mirrors `CreditSummarySheet`'s structure and its "every figure is server-computed" posture. Offers a points stepper only when the account has a redeemable `FIXED_DISCOUNT` points reward (the one case where the amount is a client choice); every other case is a single confirm.

```tsx
// components/loyalty/LoyaltyRedeemSheet.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { formatCurrency } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import type { LoyaltyAccountSummary } from '@/services/loyalty';
import { isLoyaltyRedeemable } from './LoyaltyChip';

interface LoyaltyRedeemSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (redemption: { program: 'POINTS' | 'FREQUENCY'; pointsRedeemed?: number }) => void;
  customerName: string;
  account: LoyaltyAccountSummary | null;
  cartSubtotal: number;
  currency?: string;
  loading?: boolean;
  error?: string | null;
}

export const LoyaltyRedeemSheet: React.FC<LoyaltyRedeemSheetProps> = ({
  visible, onClose, onConfirm, customerName, account, cartSubtotal, currency, loading = false, error = null,
}) => {
  const frequencyReady = !!account?.frequency.enabled
    && account.frequency.count + 1 >= account.frequency.purchasesRequired;
  const pointsReady = !!account?.points.enabled
    && account.points.balance >= Math.max(account.points.redemption.minPointsToRedeem, account.points.redemption.pointsCost);
  const isFixedDiscount = account?.points.redemption.rewardType === 'FIXED_DISCOUNT';

  // Default the selected program to whichever is ready, preferring the
  // frequency reward when both are (it is usually the bigger win for the
  // customer and, being all-or-nothing, has nothing left to configure).
  const [program, setProgram] = useState<'POINTS' | 'FREQUENCY'>(frequencyReady ? 'FREQUENCY' : 'POINTS');
  const [pointsToRedeem, setPointsToRedeem] = useState(account?.points.redemption.pointsCost ?? 0);

  useEffect(() => {
    if (!visible || !account) return;
    setProgram(frequencyReady ? 'FREQUENCY' : 'POINTS');
    setPointsToRedeem(account.points.redemption.pointsCost);
    // Only re-derive when the sheet opens with a fresh account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, account]);

  if (!account || !isLoyaltyRedeemable(account)) return null;

  const step = account.points.redemption.pointsCost || 1;
  const maxPoints = Math.min(account.points.balance, Math.floor(cartSubtotal / (account.points.redemption.rewardValue / step || 1)) || account.points.balance);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeightPercent={70}
      footer={
        <View style={styles.footer}>
          <Button title="Back" variant="ghost" onPress={onClose} style={styles.footerBtn} />
          <Button
            title="Apply Reward"
            leftIcon="star"
            onPress={() => onConfirm(program === 'POINTS' ? { program, pointsRedeemed: pointsToRedeem } : { program })}
            disabled={loading || !!error || (program === 'POINTS' && !(pointsToRedeem > 0))}
            loading={loading}
            style={styles.footerBtnPrimary}
          />
        </View>
      }
    >
      <View style={styles.body}>
        <Text style={styles.heading}>Redeem a reward</Text>
        <Text style={styles.customer} numberOfLines={1}>{customerName}</Text>

        {error ? (
          <View style={styles.notice}>
            <Ionicons name="cloud-offline-outline" size={16} color={Colors.danger} />
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : (
          <>
            {frequencyReady && (
              <AnimatedPressable
                onPress={() => setProgram('FREQUENCY')}
                style={[styles.option, program === 'FREQUENCY' && styles.optionSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: program === 'FREQUENCY' }}
              >
                <Ionicons name={program === 'FREQUENCY' ? 'radio-button-on' : 'radio-button-off'} size={18} color={Colors.primary} />
                <View style={styles.optionBody}>
                  <Text style={styles.optionTitle}>Frequency reward earned</Text>
                  <Text style={styles.optionSubtitle}>
                    {account.frequency.count + 1}/{account.frequency.purchasesRequired} — this purchase qualifies
                  </Text>
                </View>
              </AnimatedPressable>
            )}

            {pointsReady && (
              <AnimatedPressable
                onPress={() => setProgram('POINTS')}
                style={[styles.option, program === 'POINTS' && styles.optionSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: program === 'POINTS' }}
              >
                <Ionicons name={program === 'POINTS' ? 'radio-button-on' : 'radio-button-off'} size={18} color={Colors.primary} />
                <View style={styles.optionBody}>
                  <Text style={styles.optionTitle}>Spend points</Text>
                  <Text style={styles.optionSubtitle}>{account.points.balance} points available</Text>
                </View>
              </AnimatedPressable>
            )}

            {program === 'POINTS' && isFixedDiscount && (
              <View style={styles.stepperRow}>
                <AnimatedPressable
                  onPress={() => setPointsToRedeem((v) => Math.max(step, v - step))}
                  style={styles.stepperBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Redeem fewer points"
                >
                  <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                </AnimatedPressable>
                <View style={styles.stepperValue}>
                  <Text style={styles.stepperValueText}>{pointsToRedeem} pts</Text>
                  <Text style={styles.stepperHint}>
                    = {formatCurrency((pointsToRedeem / step) * account.points.redemption.rewardValue, currency)} off
                  </Text>
                </View>
                <AnimatedPressable
                  onPress={() => setPointsToRedeem((v) => Math.min(maxPoints, v + step))}
                  style={styles.stepperBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Redeem more points"
                >
                  <Ionicons name="add" size={18} color={Colors.textPrimary} />
                </AnimatedPressable>
              </View>
            )}
          </>
        )}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
  heading: {
    fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  customer: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginTop: -Spacing.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySubtle },
  optionBody: { flex: 1 },
  optionTitle: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  optionSubtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingVertical: Spacing.sm },
  stepperBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background,
  },
  stepperValue: { alignItems: 'center', minWidth: 100 },
  stepperValueText: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  stepperHint: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  notice: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', padding: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.dangerSubtle },
  noticeText: { flex: 1, fontSize: Typography.size.caption, color: Colors.danger, lineHeight: 17 },
  footer: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  footerBtn: { flex: 1 },
  footerBtnPrimary: { flex: 2 },
});
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/loyalty/LoyaltyChip.tsx components/loyalty/LoyaltyRedeemSheet.tsx
git commit -m "Add LoyaltyChip and LoyaltyRedeemSheet components"
```

---

### Task 7: Wire the attach-customer row and `LoyaltyChip` into `CartSummary`

**Files:**
- Modify: `components/sales/CartSummary.tsx`

**Interfaces:**
- Consumes: `LoyaltyChip` (Task 6).
- Produces: new `CartSummaryProps` fields `loyaltyEnabled`, `attachedCustomerName`, `onPickAttachedCustomer`, `loyaltyAccount`, `loyaltyLoading`, `onRedeemLoyalty` — consumed by Task 8 (`PosScreen`).

Purely additive: the existing `isCredit` block (required customer, credit-specific) is untouched.

- [ ] **Step 1: Add the new props**

In `components/sales/CartSummary.tsx`, add to `CartSummaryProps`, after the existing `onPickCreditCustomer?: () => void;`:

```ts
  /** True when the shop has Points and/or Frequency loyalty on at all. */
  loyaltyEnabled?: boolean;
  /** The customer attached for loyalty on a non-credit sale — optional, distinct from creditCustomerName. */
  attachedCustomerName?: string | null;
  onPickAttachedCustomer?: () => void;
  loyaltyAccount?: import('@/services/loyalty').LoyaltyAccountSummary | null;
  loyaltyLoading?: boolean;
  onRedeemLoyalty?: () => void;
```

- [ ] **Step 2: Import `LoyaltyChip`**

```ts
import { LoyaltyChip } from '@/components/loyalty/LoyaltyChip';
```

- [ ] **Step 3: Destructure the new props and render**

Add to the destructure in the `CartSummary` component:

```ts
  loyaltyEnabled = false,
  attachedCustomerName = null,
  onPickAttachedCustomer,
  loyaltyAccount = null,
  loyaltyLoading = false,
  onRedeemLoyalty,
```

Immediately after the existing `{isCredit && ( ... )}` block (the credit customer row), add:

```tsx
      {/* Optional customer attach on any non-credit sale, so they earn
          loyalty — the credit path already has its own required version above. */}
      {!isCredit && loyaltyEnabled && (
        <Animated.View entering={FadeInDown.duration(220).springify()} exiting={FadeOut.duration(150)}>
          <Text style={styles.phoneLabel}>Customer (optional)</Text>
          <AnimatedPressable
            onPress={onPickAttachedCustomer}
            style={styles.creditCustomerRow}
            pressScale={0.99}
            accessibilityRole="button"
            accessibilityLabel={attachedCustomerName ? `Customer: ${attachedCustomerName}. Tap to change.` : 'Attach a customer to earn loyalty'}
          >
            <Ionicons
              name={attachedCustomerName ? 'person-circle' : 'person-add-outline'}
              size={18}
              color={attachedCustomerName ? Colors.primary : Colors.textTertiary}
            />
            <Text
              style={[styles.creditCustomerText, !attachedCustomerName && styles.creditCustomerPlaceholder]}
              numberOfLines={1}
            >
              {attachedCustomerName || 'Attach a customer to earn loyalty'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </AnimatedPressable>
        </Animated.View>
      )}

      {(isCredit ? creditCustomerName : attachedCustomerName) && loyaltyEnabled && (
        <LoyaltyChip account={loyaltyAccount} loading={loyaltyLoading} onRedeem={onRedeemLoyalty ?? (() => {})} />
      )}
```

(Reuses the existing `styles.creditCustomerRow`/`styles.creditCustomerText`/`styles.creditCustomerPlaceholder` — they're already generic "a customer picker row," not credit-specific in appearance.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/sales/CartSummary.tsx
git commit -m "Add an optional loyalty customer-attach row and LoyaltyChip to CartSummary"
```

---

### Task 8: Wire redemption and earning into `PosScreen`

**Files:**
- Modify: `components/sales/PosScreen.tsx`

**Interfaces:**
- Consumes: `attachedCustomer`/`setAttachedCustomer` (Task 4), `getCustomerById` (`services/customers.ts`), `LoyaltyRedeemSheet` (Task 6), the new `CartSummary` props (Task 7), `CreateSaleData.loyaltyRedemption` (Task 3).

This is the checkout-flow equivalent of the existing "Credit checkout" block (`openCreditSummary`/`confirmCreditSale`/`creditSummaryVisible` etc., around line 823 today) — same shape, applied to the loyalty-redeem path, plus a customer picker for the non-credit case and a loyalty-summary fetch whenever a customer is attached.

- [ ] **Step 1: Import the new pieces**

```ts
import { LoyaltyRedeemSheet } from '@/components/loyalty/LoyaltyRedeemSheet';
import type { LoyaltyAccountSummary } from '@/services/loyalty';
```

- [ ] **Step 2: Read `attachedCustomer` from the cart store and the shop's loyalty settings**

Alongside the existing `creditCustomer, setCreditCustomer,` destructure from `useCartStore()`, add:

```ts
    attachedCustomer,
    setAttachedCustomer,
```

Alongside the existing `const creditEnabled = shopConfigData?.data?.creditSettings?.enabled ?? false;`, add:

```ts
  const loyaltySettings = shopConfigData?.data?.loyaltySettings;
  const loyaltyEnabled = !!(loyaltySettings?.points.enabled || loyaltySettings?.frequency.enabled);
  // Whichever customer is actually in play for this sale — the required
  // credit one when paying by credit, the optional attach otherwise.
  const activeLoyaltyCustomer = paymentMethod === CREDIT_METHOD_KEY ? creditCustomer : attachedCustomer;
```

- [ ] **Step 3: Fetch the loyalty summary whenever the active customer changes**

Add, near the existing credit-summary state block:

```ts
  const [loyaltyAccount, setLoyaltyAccount] = useState<LoyaltyAccountSummary | null>(null);
  const [loyaltyAccountLoading, setLoyaltyAccountLoading] = useState(false);

  React.useEffect(() => {
    if (!activeLoyaltyCustomer || !loyaltyEnabled) {
      setLoyaltyAccount(null);
      return;
    }
    let cancelled = false;
    setLoyaltyAccountLoading(true);
    getCustomerById(activeLoyaltyCustomer._id)
      .then((res) => { if (!cancelled) setLoyaltyAccount(res.data.loyalty); })
      .catch(() => { if (!cancelled) setLoyaltyAccount(null); })
      .finally(() => { if (!cancelled) setLoyaltyAccountLoading(false); });
    return () => { cancelled = true; };
  }, [activeLoyaltyCustomer?._id, loyaltyEnabled]);
```

(`getCustomerById` is already imported in this file for the credit summary sheet.)

- [ ] **Step 4: The redeem sheet and its confirm handler**

Add, alongside the existing "Credit checkout" block:

```ts
  // ── Loyalty redemption ─────────────────────────────────────────────────
  // Realtime-only, like a credit sale: services/sales.ts marks any request
  // carrying loyaltyRedemption realtimeOnly, so it fails visibly offline
  // rather than risking a double-redeemed reward.
  const [loyaltyRedeemVisible, setLoyaltyRedeemVisible] = useState(false);

  const confirmLoyaltyRedemption = (redemption: NonNullable<CreateSaleData['loyaltyRedemption']>) => {
    setLoyaltyRedeemVisible(false);
    submitSale({
      items: buildSaleItems(),
      paymentMethod: chosenMethod,
      ...(activeLoyaltyCustomer ? { customerId: activeLoyaltyCustomer._id } : {}),
      loyaltyRedemption: redemption,
    });
  };
```

- [ ] **Step 5: Clear the attached customer on a completed sale**

In the mutation's `onSuccess` (the same handler that already does `setCreditCustomer(null);`), add:

```ts
      setAttachedCustomer(null);
```

- [ ] **Step 6: Render the row and sheet**

Pass the new props to the existing `<CartSummary ... />` element:

```tsx
        loyaltyEnabled={loyaltyEnabled}
        attachedCustomerName={attachedCustomer?.name ?? null}
        onPickAttachedCustomer={() => router.push('/(owner)/pick-credit-customer' as never)}
        loyaltyAccount={loyaltyAccount}
        loyaltyLoading={loyaltyAccountLoading}
        onRedeemLoyalty={() => setLoyaltyRedeemVisible(true)}
```

This reuses the existing `pick-credit-customer` picker screens (`app/(owner)/pick-credit-customer.tsx` and `app/(staff)/pick-credit-customer.tsx`) — they already do "search + inline create" against `/customers` and have nothing credit-specific about their picker UI beyond which cart-store setter they call on confirm. Both files today are:

```tsx
// app/(owner)/pick-credit-customer.tsx (current)
import React from 'react';
import { router } from 'expo-router';
import { CustomerPickerScreen } from '@/components/credit/CustomerPickerScreen';
import { useCartStore } from '@/store/staffCartStore';
import { useAuthStore } from '@/store/authStore';

export default function OwnerPickCreditCustomerScreen() {
  const setCreditCustomer = useCartStore((s) => s.setCreditCustomer);
  const currency = useAuthStore((s) => s.user?.shop?.currency);

  return (
    <CustomerPickerScreen
      currency={currency}
      onSelect={(customer) => {
        setCreditCustomer({ _id: customer._id, name: customer.name });
        router.back();
      }}
    />
  );
}
```

Change both files (`app/(owner)/pick-credit-customer.tsx` and `app/(staff)/pick-credit-customer.tsx`, same edit in each) to read a `mode` route param, defaulting to `'credit'` so the existing entry points (which push this route with no params) are unaffected:

```tsx
// app/(owner)/pick-credit-customer.tsx
import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { CustomerPickerScreen } from '@/components/credit/CustomerPickerScreen';
import { useCartStore } from '@/store/staffCartStore';
import { useAuthStore } from '@/store/authStore';

export default function OwnerPickCreditCustomerScreen() {
  const { mode } = useLocalSearchParams<{ mode?: 'credit' | 'attach' }>();
  const setCreditCustomer = useCartStore((s) => s.setCreditCustomer);
  const setAttachedCustomer = useCartStore((s) => s.setAttachedCustomer);
  const currency = useAuthStore((s) => s.user?.shop?.currency);

  return (
    <CustomerPickerScreen
      currency={currency}
      onSelect={(customer) => {
        if (mode === 'attach') {
          setAttachedCustomer({ _id: customer._id, name: customer.name });
        } else {
          setCreditCustomer({ _id: customer._id, name: customer.name });
        }
        router.back();
      }}
    />
  );
}
```

Apply the identical change to `app/(staff)/pick-credit-customer.tsx`. Then in `PosScreen.tsx`, pass `mode: 'attach'` from the loyalty attach row:

```tsx
        onPickAttachedCustomer={() => router.push({
          pathname: user?.role === 'staff' ? '/(staff)/pick-credit-customer' : '/(owner)/pick-credit-customer',
          params: { mode: 'attach' },
        } as never)}
```

(Mirrors the existing `onPickCreditCustomer` handler at line 1303 — `router.push((user?.role === 'staff' ? '/(staff)/pick-credit-customer' : '/(owner)/pick-credit-customer') as never)` — same role branch, with `params: { mode: 'attach' }` added.)

Add the sheet near the existing `<CreditSummarySheet ... />`:

```tsx
      <LoyaltyRedeemSheet
        visible={loyaltyRedeemVisible}
        onClose={() => setLoyaltyRedeemVisible(false)}
        onConfirm={confirmLoyaltyRedemption}
        customerName={activeLoyaltyCustomer?.name ?? ''}
        account={loyaltyAccount}
        cartSubtotal={totalAmount}
        currency={user?.shop?.currency}
        loading={createSaleMutation.isPending}
      />
```

(`totalAmount` is the existing variable this file already computes at `const totalAmount = cartPromoResults.reduce((sum, r) => sum + r.subtotal, 0);` and passes to `CartSummary`'s own `total` prop and to `CreditSummarySheet`'s `saleAmount` prop — reuse that same value.)

- [ ] **Step 7: Manual verification**

Run the dev server, sign in as a cashier permitted `record_sale` and `redeem_loyalty_reward`, with Points and Frequency both on for the shop: ring up a cash sale, attach a customer with the optional row, confirm the chip shows their balance/progress after checkout completes; repeat with enough prior purchases that "Redeem" appears, confirm the sheet, and verify the discount reduced the total and the receipt/customer profile reflects it.

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add components/sales/PosScreen.tsx "app/(owner)/pick-credit-customer.tsx" "app/(staff)/pick-credit-customer.tsx"
git commit -m "Wire loyalty attach, summary, and redemption into the till"
```

---

### Task 9: Loyalty section on `CustomerAccountScreen`

**Files:**
- Create: `components/loyalty/LoyaltyTransactionRow.tsx`
- Modify: `components/credit/CustomerAccountScreen.tsx`

**Interfaces:**
- Consumes: `LoyaltyTransaction`, `LoyaltyAccountSummary` (Task 1), `CustomerDetail.loyalty`/`loyaltyTransactions` (Task 2).

- [ ] **Step 1: Write `LoyaltyTransactionRow.tsx`**

Mirrors `CreditTransactionRow`'s row shape (icon, label, timestamp, signed amount) at a lighter weight — a points/frequency movement, not a debt.

```tsx
// components/loyalty/LoyaltyTransactionRow.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDate } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import type { LoyaltyTransaction } from '@/services/loyalty';

const LABEL: Record<LoyaltyTransaction['type'], string> = {
  POINTS_EARNED: 'Points earned',
  POINTS_REDEEMED: 'Points redeemed',
  POINTS_EARNED_REVERSED: 'Points earned — reversed',
  POINTS_REDEEMED_REVERSED: 'Points redemption — reversed',
  FREQUENCY_PROGRESS: 'Purchase counted',
  FREQUENCY_PROGRESS_REVERSED: 'Purchase count — reversed',
  FREQUENCY_REWARD_REDEEMED: 'Frequency reward redeemed',
  FREQUENCY_REWARD_REVERSED: 'Frequency reward — reversed',
};

const ICON: Record<LoyaltyTransaction['type'], keyof typeof Ionicons.glyphMap> = {
  POINTS_EARNED: 'star-outline',
  POINTS_REDEEMED: 'star',
  POINTS_EARNED_REVERSED: 'arrow-undo-outline',
  POINTS_REDEEMED_REVERSED: 'arrow-undo-outline',
  FREQUENCY_PROGRESS: 'checkmark-circle-outline',
  FREQUENCY_PROGRESS_REVERSED: 'arrow-undo-outline',
  FREQUENCY_REWARD_REDEEMED: 'gift',
  FREQUENCY_REWARD_REVERSED: 'arrow-undo-outline',
};

interface LoyaltyTransactionRowProps {
  transaction: LoyaltyTransaction;
  isLast?: boolean;
}

export const LoyaltyTransactionRow: React.FC<LoyaltyTransactionRowProps> = ({ transaction, isLast = false }) => {
  const isReversal = transaction.type.endsWith('_REVERSED');
  const detail = transaction.program === 'POINTS'
    ? `${transaction.points ?? 0} pts`
    : `${transaction.frequencyCountAfter ?? 0} progress`;

  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={[styles.iconWrap, isReversal && styles.iconWrapMuted]}>
        <Ionicons name={ICON[transaction.type]} size={16} color={isReversal ? Colors.textTertiary : Colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{LABEL[transaction.type]}</Text>
        <Text style={styles.subtitle}>{formatDate(transaction.createdAt)}{transaction.staffName ? ` · ${transaction.staffName}` : ''}</Text>
      </View>
      <Text style={[styles.amount, isReversal && styles.amountMuted]}>{detail}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  iconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center' },
  iconWrapMuted: { backgroundColor: Colors.divider },
  body: { flex: 1 },
  title: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  subtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  amount: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  amountMuted: { color: Colors.textTertiary },
});
```

- [ ] **Step 2: Add the Loyalty section to `CustomerAccountScreen.tsx`**

Add the import:

```ts
import { LoyaltyTransactionRow } from '@/components/loyalty/LoyaltyTransactionRow';
```

Immediately after the existing `History` section (the block starting `<View style={styles.sectionHeader}>` for `customer.transactions`, through its closing `)}`), add a parallel Loyalty section:

```tsx
        {customer.loyalty && (customer.loyalty.points.enabled || customer.loyalty.frequency.enabled) && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Loyalty</Text>
            </View>
            <View style={styles.timelineCard}>
              <View style={styles.loyaltySummaryRow}>
                {customer.loyalty.points.enabled && (
                  <View style={styles.balanceMetaItem}>
                    <Text style={styles.balanceMetaLabel}>Points</Text>
                    <Text style={styles.balanceMetaValue}>{customer.loyalty.points.balance}</Text>
                  </View>
                )}
                {customer.loyalty.frequency.enabled && (
                  <View style={styles.balanceMetaItem}>
                    <Text style={styles.balanceMetaLabel}>Progress</Text>
                    <Text style={styles.balanceMetaValue}>
                      {customer.loyalty.frequency.count}/{customer.loyalty.frequency.purchasesRequired}
                    </Text>
                  </View>
                )}
              </View>
              {customer.loyaltyTransactions.length === 0 ? (
                <Text style={styles.contactOnlyText}>No loyalty activity yet.</Text>
              ) : (
                customer.loyaltyTransactions.map((tx, i) => (
                  <LoyaltyTransactionRow key={tx._id} transaction={tx} isLast={i === customer.loyaltyTransactions.length - 1} />
                ))
              )}
            </View>
          </>
        )}
```

Add one small style, alongside the existing `balanceMetaRow` style:

```ts
  loyaltySummaryRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
    gap: Spacing.lg,
  },
```

- [ ] **Step 3: Manual verification**

Open a customer's account screen for a customer with both loyalty activity and credit history; confirm both sections render independently and neither breaks when the other is empty/disabled (toggle Points/Frequency off in Settings and confirm the Loyalty section disappears entirely rather than showing an empty state).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/loyalty/LoyaltyTransactionRow.tsx components/credit/CustomerAccountScreen.tsx
git commit -m "Add a Loyalty section to the customer account screen"
```

---

### Task 10: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: PASS, zero errors

- [ ] **Step 2: Full test suite**

Run: `npx jest`
Expected: PASS, including the two new files from Tasks 1 and 3

- [ ] **Step 3: Manual end-to-end pass on device/simulator**

With the backend plan's Tasks 1–11 deployed (or run locally against this branch): as owner, configure both Points and Frequency in Settings; as staff with `record_sale` only (no `redeem_loyalty_reward`), attach a customer to a cash sale and confirm points/progress accrue but the Redeem pill either doesn't act or is refused server-side; grant `redeem_loyalty_reward` and confirm a redemption succeeds and reduces the total; void that sale and confirm the customer's points/progress are restored on their account screen.

- [ ] **Step 4: Commit**

Only if Step 3 surfaced fixes — otherwise nothing to commit; this task is a checkpoint, not a deliverable.
