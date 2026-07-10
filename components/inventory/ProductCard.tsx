import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { formatCurrency } from '@/utils/formatters';
import type { ProductType } from '@/services/products';

// ─── Category color palette (deterministic from name hash) ───────────────────
const CATEGORY_PALETTE = [
  { bg: '#EFF6FF', text: '#1D4ED8' },
  { bg: '#F0FDF4', text: '#15803D' },
  { bg: '#FFF7ED', text: '#C2410C' },
  { bg: '#FDF4FF', text: '#7E22CE' },
  { bg: '#FFF1F2', text: '#BE123C' },
  { bg: '#F0FDFA', text: '#0F766E' },
  { bg: '#FFFBEB', text: '#B45309' },
  { bg: '#F1F5F9', text: '#475569' },
];

function getCategoryColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── Stock status ─────────────────────────────────────────────────────────────
type StockStatus = 'in_stock' | 'low' | 'critical' | 'stockout';

function getStockStatus(quantity: number, lowStockAlert: number): StockStatus {
  if (quantity === 0) return 'stockout';
  if (quantity <= Math.ceil(lowStockAlert * 0.5)) return 'critical';
  if (quantity <= lowStockAlert) return 'low';
  return 'in_stock';
}

const STATUS_CONFIG: Record<StockStatus, { label: string; bg: string; text: string; bar: string }> = {
  in_stock: { label: 'In Stock', bg: '#DCFCE7', text: '#15803D', bar: '#22C55E' },
  low: { label: 'Low Stock', bg: '#FEF3C7', text: '#D97706', bar: '#F59E0B' },
  critical: { label: 'Critical', bg: '#FEE2E2', text: '#DC2626', bar: '#EF4444' },
  stockout: { label: 'Stockout', bg: '#FEE2E2', text: '#DC2626', bar: '#EF4444' },
};

// ─── Product type badges ──────────────────────────────────────────────────────
const TYPE_BADGES: Partial<Record<ProductType, { icon: keyof typeof Ionicons.glyphMap; label: string }>> = {
  variable: { icon: 'pricetags-outline', label: 'Variable' },
  weighted: { icon: 'scale-outline', label: 'Weighted' },
  refillable: { icon: 'water-outline', label: 'Refillable' },
  service: { icon: 'construct-outline', label: 'Service' },
  bundle: { icon: 'gift-outline', label: 'Bundle' },
  configurable: { icon: 'options-outline', label: 'Variants' },
};

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    category: string;
    sellingPrice: number;
    costPrice?: number;
    quantity: number;
    lowStockAlert: number;
    productType?: ProductType;
    trackInventory?: boolean;
  };
  showCostPrice?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpdateStock?: () => void;
  showActions?: boolean;
  /** Suppresses bottom hairline — set on last row in list. */
  isLast?: boolean;
  /** List index for staggered entrance animation. */
  index?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  showCostPrice = false,
  onPress,
  onEdit,
  onDelete,
  onUpdateStock,
  showActions = false,
  isLast = false,
  index = 0,
}) => {
  const trackInventory = product.trackInventory ?? true;
  const status = trackInventory ? getStockStatus(product.quantity, product.lowStockAlert) : 'in_stock';
  const statusConfig = STATUS_CONFIG[status];
  const categoryColor = getCategoryColor(product.category);
  const initials = getInitials(product.name);
  const typeBadge = product.productType ? TYPE_BADGES[product.productType] : undefined;

  const showMargin =
    showCostPrice &&
    product.costPrice !== undefined &&
    product.costPrice > 0 &&
    product.sellingPrice > 0;

  const margin = showMargin
    ? Math.round(((product.sellingPrice - (product.costPrice ?? 0)) / product.sellingPrice) * 100)
    : null;

  const marginBgColor =
    margin === null ? undefined : margin >= 25 ? '#DCFCE7' : margin >= 15 ? '#FEF3C7' : '#FEE2E2';
  const marginTextColor =
    margin === null ? undefined : margin >= 25 ? '#15803D' : margin >= 15 ? '#D97706' : '#DC2626';

  // Stock bar width percentage — relative to the "full" reference point
  const maxRef = Math.max(product.quantity, product.lowStockAlert * 5, 20);
  const stockPct = Math.max(0, Math.min(product.quantity / maxRef, 1));

  return (
    <Animated.View entering={FadeInDown.duration(280).delay(Math.min(index * 55, 480))}>
      <AnimatedPressable onPress={onPress} style={styles.card}>
        {/* ── Top row: avatar + name/meta + status badge ── */}
        <View style={styles.topRow}>
          <View style={[styles.avatar, { backgroundColor: categoryColor.bg }]}>
            <Text style={[styles.avatarText, { color: categoryColor.text }]}>{initials}</Text>
          </View>

          <View style={styles.nameBlock}>
            <Text style={styles.name} numberOfLines={1}>
              {product.name}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.categoryLabel}>{product.category}</Text>
              {typeBadge && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Ionicons name={typeBadge.icon} size={11} color={Colors.textTertiary} />
                  <Text style={styles.categoryLabel}>{typeBadge.label}</Text>
                </>
              )}
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.text }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Price row ── */}
        <View style={styles.priceRow}>
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>SELL</Text>
            <Text style={styles.priceValue}>{formatCurrency(product.sellingPrice)}</Text>
          </View>

          {showCostPrice && product.costPrice !== undefined && (
            <>
              <View style={styles.priceSep} />
              <View style={styles.priceBlock}>
                <Text style={styles.priceLabel}>COST</Text>
                <Text style={styles.priceMuted}>{formatCurrency(product.costPrice)}</Text>
              </View>
            </>
          )}

          {margin !== null && (
            <>
              <View style={styles.priceSep} />
              <View style={styles.priceBlock}>
                <Text style={styles.priceLabel}>MARGIN</Text>
                <View style={[styles.marginPill, { backgroundColor: marginBgColor }]}>
                  <Text style={[styles.marginText, { color: marginTextColor }]}>{margin}%</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Stock bar ── */}
        {trackInventory && (
          <View style={styles.stockSection}>
            <View style={styles.stockLabelRow}>
              <Text style={styles.stockLabel}>STOCK</Text>
              <Text style={[styles.stockCount, { color: statusConfig.text }]}>
                {product.quantity} unit{product.quantity !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${stockPct * 100}%` as `${number}%`,
                    backgroundColor: statusConfig.bar,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* ── Action row ── */}
        {showActions && (
          <>
            <View style={styles.divider} />
            <View style={styles.actionRow}>
              {onUpdateStock && (
                <AnimatedPressable
                  onPress={onUpdateStock}
                  style={styles.actionBtn}
                  hitSlop={HIT_SLOP}
                  accessibilityLabel="Adjust stock"
                  accessibilityRole="button"
                >
                  <Ionicons name="archive-outline" size={15} color={Colors.warning} />
                  <Text style={[styles.actionLabel, { color: Colors.warning }]}>Adjust</Text>
                </AnimatedPressable>
              )}
              {onEdit && (
                <AnimatedPressable
                  onPress={onEdit}
                  style={styles.actionBtn}
                  hitSlop={HIT_SLOP}
                  accessibilityLabel="Edit product"
                  accessibilityRole="button"
                >
                  <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
                  <Text style={[styles.actionLabel, { color: Colors.primary }]}>Edit</Text>
                </AnimatedPressable>
              )}

              <View style={styles.actionSpacer} />

              {onDelete && (
                <AnimatedPressable
                  onPress={onDelete}
                  style={[styles.actionBtn, styles.deleteBtn]}
                  hitSlop={HIT_SLOP}
                  accessibilityLabel="Delete product"
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                  <Text style={[styles.actionLabel, { color: Colors.danger }]}>Delete</Text>
                </AnimatedPressable>
              )}
            </View>
          </>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // ── Top row ──────────────────────────────────────────────────────────────
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: Typography.fontFamilyBold,
  },
  nameBlock: {
    flex: 1,
    gap: 3,
    paddingTop: 1,
  },
  name: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    lineHeight: Typography.lineHeight.body,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  categoryLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  metaDot: {
    fontSize: Typography.size.caption,
    color: Colors.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    flexShrink: 0,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },

  // ── Price row ─────────────────────────────────────────────────────────────
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  priceBlock: {
    flex: 1,
    gap: 3,
  },
  priceSep: {
    width: 1,
    height: 30,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.sm,
  },
  priceLabel: {
    fontSize: 9,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 0.6,
  },
  priceValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  priceMuted: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  marginPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  marginText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
  },

  // ── Stock bar ─────────────────────────────────────────────────────────────
  stockSection: {
    gap: 6,
    marginBottom: 2,
  },
  stockLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 9,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 0.6,
  },
  stockCount: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
  },
  barTrack: {
    height: 6,
    backgroundColor: Colors.divider,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 4,
  },

  // ── Action row ────────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deleteBtn: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  actionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
  },
  actionSpacer: {
    flex: 1,
  },
});
