import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import {
  MONEY_OUT_METHODS,
  MONEY_OUT_METHOD_LABELS,
  type MoneyOutMethod,
} from '@/constants/paymentMethods';

interface PaymentMethodSelectorProps {
  value: MoneyOutMethod;
  onChange: (method: MoneyOutMethod) => void;
  label?: string;
}

const ICONS: Record<MoneyOutMethod, keyof typeof Ionicons.glyphMap> = {
  cash: 'cash-outline',
  mpesa: 'phone-portrait-outline',
  bank: 'business-outline',
  credit: 'time-outline',
};

/**
 * Shared "how was this paid" chip row for expenses and purchases.
 *
 * Exists so the Cashbook can tell till cash from M-Pesa, and stock taken on
 * account from stock paid for on the spot.
 */
export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  value,
  onChange,
  label = 'Paid with',
}) => (
  <>
    <Text style={styles.sectionLabel}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
      {MONEY_OUT_METHODS.map((method) => {
        const active = value === method;
        return (
          <AnimatedPressable
            key={method}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(method)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={MONEY_OUT_METHOD_LABELS[method]}
          >
            <Ionicons
              name={ICONS[method]}
              size={16}
              color={active ? Colors.white : Colors.textSecondary}
            />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {MONEY_OUT_METHOD_LABELS[method]}
            </Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>

    {value === 'credit' && (
      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
        <Text style={styles.noteText}>
          No money has left your till yet. This won&apos;t show in your cashbook until you pay.
        </Text>
      </View>
    )}
  </>
);

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  row: { marginBottom: Spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  chipTextActive: { color: Colors.white },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  noteText: {
    flex: 1,
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
});
