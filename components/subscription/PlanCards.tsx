import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Scene } from '@/components/onboarding/theme';
import { haptics } from '@/utils/haptics';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';
import type { BillingCycle, SubscriptionPlan } from '@/services/subscription';

interface PlanCardsProps {
  plans: SubscriptionPlan[];
  staffCount: number;
  currency: string;
  billingCycle: BillingCycle;
  onBillingCycleChange: (cycle: BillingCycle) => void;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}

/**
 * The pricing cards on the "Activate Smart Duka" screen — dark glass styling
 * to sit on the onboarding scene. Every price, bullet, and badge comes from
 * the backend; this component only lays them out.
 */
export const PlanCards: React.FC<PlanCardsProps> = ({
  plans,
  staffCount,
  currency,
  billingCycle,
  onBillingCycleChange,
  selectedSlug,
  onSelect,
}) => {
  const yearly = billingCycle === 'yearly';
  const discountPercent = plans.find((p) => p.recommended)?.yearlyDiscountPercent
    ?? plans[0]?.yearlyDiscountPercent ?? 0;

  return (
    <View>
      {/* Monthly / Yearly toggle */}
      <View style={styles.toggleRow}>
        {(['monthly', 'yearly'] as const).map((cycle) => {
          const active = billingCycle === cycle;
          return (
            <AnimatedPressable
              key={cycle}
              onPress={() => {
                if (!active) {
                  haptics.light();
                  onBillingCycleChange(cycle);
                }
              }}
              style={[styles.toggleBtn, active && styles.toggleBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={cycle === 'monthly' ? 'Pay monthly' : 'Pay yearly'}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
              </Text>
              {cycle === 'yearly' && discountPercent > 0 && (
                <View style={styles.saveChip}>
                  <Text style={styles.saveChipText}>Save {discountPercent}%</Text>
                </View>
              )}
            </AnimatedPressable>
          );
        })}
      </View>

      {plans.map((plan) => {
        const selected = selectedSlug === plan.slug;
        const perStaff = plan.billingType === 'per_staff';
        const bigPrice = yearly
          ? plan.pricing.yearlyTotal
          : perStaff ? plan.monthlyPrice : plan.pricing.monthlyTotal;
        const unit = yearly ? 'per year' : perStaff ? 'per staff / month' : 'per month';

        return (
          <AnimatedPressable
            key={plan.slug}
            onPress={() => {
              haptics.light();
              onSelect(plan.slug);
            }}
            style={[styles.card, selected && styles.cardSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${plan.name} plan`}
          >
            {!!plan.badge && (
              <View style={styles.badge}>
                <Ionicons name="star" size={11} color={Scene.bgFrom} />
                <Text style={styles.badgeText}>{plan.badge}</Text>
              </View>
            )}

            <View style={styles.cardHeader}>
              <View style={styles.radioOuter}>
                {selected && <View style={styles.radioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{plan.name}</Text>
                {!!plan.tagline && <Text style={styles.planTagline}>{plan.tagline}</Text>}
              </View>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceValue}>{formatCurrency(bigPrice, currency)}</Text>
              <Text style={styles.priceUnit}>{unit}</Text>
            </View>

            {!yearly && perStaff && staffCount > 1 && (
              <Text style={styles.teamNote}>
                {formatCurrency(plan.pricing.monthlyTotal, currency)} / month for your team of {staffCount}
              </Text>
            )}
            {yearly && plan.pricing.yearlySavings > 0 && (
              <Text style={styles.savingsNote}>
                You’re saving {formatCurrency(plan.pricing.yearlySavings, currency)} every year.
              </Text>
            )}
            {!yearly && !!plan.priceComparison && (
              <Text style={styles.comparison}>{plan.priceComparison}</Text>
            )}

            <View style={styles.highlights}>
              {plan.highlights.map((item) => (
                <View key={item} style={styles.highlightItem}>
                  <Ionicons name="checkmark-circle" size={15} color={Scene.glow} />
                  <Text style={styles.highlightText}>{item}</Text>
                </View>
              ))}
            </View>
          </AnimatedPressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Scene.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Scene.cardBorderSoft,
    padding: 4,
    marginBottom: Spacing.md,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(45,212,191,0.16)',
    borderWidth: 1,
    borderColor: Scene.cardBorder,
  },
  toggleText: {
    color: Scene.textDim,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  toggleTextActive: { color: Scene.text },
  saveChip: {
    backgroundColor: Scene.gold,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saveChipText: {
    color: Scene.bgFrom,
    fontSize: 10,
    fontFamily: Typography.fontFamilyBold,
  },
  card: {
    backgroundColor: Scene.cardBg,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Scene.cardBorderSoft,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardSelected: {
    borderColor: Scene.glow,
    backgroundColor: 'rgba(45,212,191,0.08)',
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Scene.gold,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: Scene.bgFrom,
    fontSize: 11,
    fontFamily: Typography.fontFamilyBold,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Scene.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Scene.glow,
  },
  planName: {
    color: Scene.text,
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
  },
  planTagline: {
    color: Scene.textDim,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    marginTop: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  priceValue: {
    color: Scene.text,
    fontSize: Typography.size.h1,
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: -0.5,
  },
  priceUnit: {
    color: Scene.textDim,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
  },
  teamNote: {
    color: Scene.textDim,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    marginTop: 2,
  },
  savingsNote: {
    color: Scene.glowSoft,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    marginTop: 2,
  },
  comparison: {
    color: Scene.textFaint,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    fontStyle: 'italic',
    marginTop: 2,
  },
  highlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '50%',
    paddingVertical: 3,
  },
  highlightText: {
    color: Scene.textDim,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    flexShrink: 1,
  },
});
