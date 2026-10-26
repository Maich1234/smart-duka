import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { formatCurrency, formatQuantity } from '@/utils/formatters';
import type { Product } from '@/services/products';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/**
 * One product, as the till needs it.
 *
 * The inventory ProductCard was doing this job: an avatar, a category, a
 * status pill, a divider, a two-column price block, a shadow and a 20pt
 * radius — about 140pt of height to say a name and a price. A cashier
 * scanning for the right item reads four things and taps: what it is, what it
 * costs, whether there is any, and where to tap. Everything else is weight
 * between them and the next sale.
 *
 * The whole row is the add target, with a visible + so the affordance is not
 * folded invisibly into the card. Products that need a follow-up question
 * (a size, a weight, a price) say so, because otherwise the same tap
 * sometimes adds and sometimes opens a sheet with nothing to predict which.
 */

interface PosProductRowProps {
  product: Product;
  onPress: () => void;
  currency?: string;
  quantity?: number;
  disabled?: boolean;
  onDecrement?: () => void;
}

/** The follow-up a tap will ask for, when there is one. */
function actionHint(product: Product): string | null {
  switch (product.productType) {
    case 'configurable': return 'Choose option';
    case 'variable': return 'Enter price';
    case 'weighted':
    case 'refillable': return `Per ${product.unitOfMeasure ?? 'unit'}`;
    case 'bundle': return 'Bundle';
    default: return null;
  }
}

/** Lowest variant price, so a configurable product still shows what it costs. */
function displayPrice(product: Product): { amount: number; from: boolean } {
  if (product.productType === 'configurable' && product.variants?.length) {
    return { amount: Math.min(...product.variants.map((v) => v.sellingPrice)), from: true };
  }
  return { amount: product.sellingPrice, from: false };
}

type Stock = { label: string; tone: 'ok' | 'low' | 'out' } | null;

function stockFor(product: Product): Stock {
  // A service has nothing to count, and a bundle's stock lives in its
  // components — claiming either is "out" would block a sale that is fine.
  if (product.trackInventory === false) return null;
  if (product.productType === 'service' || product.productType === 'bundle') return null;

  if (product.productType === 'configurable') {
    const total = (product.variants ?? []).reduce((sum, v) => sum + (v.quantity ?? 0), 0);
    if (total <= 0) return { label: 'Out of stock', tone: 'out' };
    return { label: `${formatQuantity(total)} left`, tone: 'ok' };
  }

  const qty = product.quantity ?? 0;
  // <= 0, not === 0: the offline cache goes negative when stock is sold past
  // zero, which is still out of stock rather than a strange positive number.
  if (qty <= 0) return { label: 'Out of stock', tone: 'out' };
  if (qty <= (product.lowStockAlert ?? 0)) return { label: `Only ${formatQuantity(qty)} left`, tone: 'low' };
  return { label: `${formatQuantity(qty)} in stock`, tone: 'ok' };
}

const TONE_COLOR = {
  ok: Colors.textSecondary,
  low: Colors.warningDark,
  out: Colors.danger,
} as const;

const PosProductRowComponent: React.FC<PosProductRowProps> = ({ product, onPress, currency, quantity = 0, disabled = false, onDecrement }) => {
  const price = displayPrice(product);
  const stock = stockFor(product);
  const hint = actionHint(product);

  return (
    <View style={[s.row, quantity > 0 && { backgroundColor: Colors.primarySubtle }]}>
      <AnimatedPressable onPress={onPress} disabled={disabled} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 }} accessibilityRole="button" accessibilityLabel={`${product.name}, ${formatCurrency(price.amount, currency)}, ${stock?.label ?? ''}`} accessibilityHint={hint ? 'Opens product options' : 'Adds one to the sale'}>
        <View style={s.avatar}><Text style={s.initials}>{product.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</Text></View>
        <View style={s.text}>
          <Text style={s.name}>{product.name}</Text>
          {!!stock && <Text style={[s.stock, { color: TONE_COLOR[stock.tone] }]}>{stock.label}</Text>}
          {!!hint && <Text style={s.hint}>{hint}</Text>}
        </View>
      </AnimatedPressable>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={s.price}>{price.from ? 'From ' : ''}{formatCurrency(price.amount, currency)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {quantity > 0 && onDecrement && <AnimatedPressable disabled={disabled} onPress={onDecrement} style={s.add} accessibilityRole="button" accessibilityLabel={`Decrease ${product.name} quantity`}><Text style={{ color: Colors.primary }}>−</Text></AnimatedPressable>}
          {quantity > 0 && <Text accessibilityLiveRegion="polite" style={{ color: Colors.textPrimary }}>{formatQuantity(quantity)}</Text>}
          <AnimatedPressable disabled={disabled} onPress={onPress} style={s.add} accessibilityRole="button" accessibilityLabel={`${hint ? 'Choose' : 'Add'} ${product.name}`}><Text style={{ color: Colors.primary }}>{hint ? 'Choose' : '+'}</Text></AnimatedPressable>
        </View>
      </View>
    </View>
  );
};

export const PosProductRow = React.memo(PosProductRowComponent);

const s = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: Typography.fontFamilySemiBold, color: Colors.primary, fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingLeft: Spacing.md,
    paddingRight: 10,
    paddingVertical: 10,
    // Comfortably past the 48dp floor without the card height the inventory
    // list needs.
    minHeight: 88,
  },
  text: { flex: 1, gap: 3 },
  name: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  price: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  dot: { fontSize: Typography.size.caption, color: Colors.borderStrong },
  stock: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
  },
  hint: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.primary,
  },
  add: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
