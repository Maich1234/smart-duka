import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { formatCurrency } from '@/utils/formatters';
import { Ionicons } from '@expo/vector-icons';
import type { ProductType } from '@/services/products';

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

const TYPE_BADGES: Partial<Record<ProductType, { icon: keyof typeof Ionicons.glyphMap; label: string }>> = {
  variable: { icon: 'pricetags-outline', label: 'Variable' },
  weighted: { icon: 'scale-outline', label: 'Weighted' },
  refillable: { icon: 'water-outline', label: 'Refillable' },
  service: { icon: 'construct-outline', label: 'Service' },
  bundle: { icon: 'gift-outline', label: 'Bundle' },
  configurable: { icon: 'options-outline', label: 'Variants' },
};

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
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  showCostPrice = false,
  onPress,
  onEdit,
  onDelete,
  onUpdateStock,
  showActions = false,
}) => {
  const isLowStock = product.quantity <= product.lowStockAlert;
  const trackInventory = product.trackInventory ?? true;
  const typeBadge = product.productType ? TYPE_BADGES[product.productType] : undefined;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={styles.content}>
          <View style={styles.info}>
            <Text style={styles.name}>{product.name}</Text>
            <View style={styles.categoryRow}>
              <Text style={styles.category}>{product.category}</Text>
              {typeBadge && (
                <View style={styles.typeBadge}>
                  <Ionicons name={typeBadge.icon} size={11} color={Colors.textSecondary} />
                  <Text style={styles.typeBadgeText}>{typeBadge.label}</Text>
                </View>
              )}
            </View>
            <Text style={styles.price}>Sell: {formatCurrency(product.sellingPrice)}</Text>
            {showCostPrice && product.costPrice !== undefined && (
              <Text style={styles.costPrice}>Cost: {formatCurrency(product.costPrice)}</Text>
            )}
            {trackInventory && (
              <View style={styles.stockRow}>
                <Text style={[styles.stock, isLowStock && styles.lowStock]}>Stock: {product.quantity}</Text>
                {isLowStock && <Text style={styles.lowStockBadge}>Low</Text>}
              </View>
            )}
          </View>
          {showActions && (
            <View style={styles.actions}>
              {onUpdateStock && (
                <TouchableOpacity
                  onPress={onUpdateStock}
                  style={styles.actionBtn}
                  hitSlop={HIT_SLOP}
                  accessibilityLabel="Update stock"
                  accessibilityRole="button"
                >
                  <Ionicons name="archive-outline" size={22} color={Colors.warning} />
                </TouchableOpacity>
              )}
              {onEdit && (
                <TouchableOpacity
                  onPress={onEdit}
                  style={styles.actionBtn}
                  hitSlop={HIT_SLOP}
                  accessibilityLabel="Edit product"
                  accessibilityRole="button"
                >
                  <Ionicons name="pencil-outline" size={22} color={Colors.primary} />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  onPress={onDelete}
                  style={styles.actionBtn}
                  hitSlop={HIT_SLOP}
                  accessibilityLabel="Delete product"
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={22} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.md, marginVertical: Spacing.xs, padding: Spacing.md },
  content: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info: { flex: 1 },
  name: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  category: { fontSize: Typography.size.small, color: Colors.textSecondary },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.background, paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.sm },
  typeBadgeText: { fontSize: Typography.size.caption, color: Colors.textSecondary },
  price: { fontSize: Typography.size.small, color: Colors.success, marginTop: 2 },
  costPrice: { fontSize: Typography.size.small, color: Colors.textSecondary, marginTop: 2 },
  stockRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: Spacing.sm },
  stock: { fontSize: Typography.size.small, color: Colors.textSecondary },
  lowStock: { color: Colors.danger, fontFamily: Typography.fontFamilySemiBold },
  lowStockBadge: { fontSize: Typography.size.caption, color: Colors.surface, backgroundColor: Colors.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.md, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { padding: Spacing.xs },
});