import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';
import { Ionicons } from '@expo/vector-icons';

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    category: string;
    sellingPrice: number;
    costPrice?: number;
    quantity: number;
    lowStockAlert: number;
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

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={styles.content}>
          <View style={styles.info}>
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.category}>{product.category}</Text>
            <Text style={styles.price}>Sell: {formatCurrency(product.sellingPrice)}</Text>
            {showCostPrice && product.costPrice !== undefined && (
              <Text style={styles.costPrice}>Cost: {formatCurrency(product.costPrice)}</Text>
            )}
            <View style={styles.stockRow}>
              <Text style={[styles.stock, isLowStock && styles.lowStock]}>Stock: {product.quantity}</Text>
              {isLowStock && <Text style={styles.lowStockBadge}>Low</Text>}
            </View>
          </View>
          {showActions && (
            <View style={styles.actions}>
              {onUpdateStock && (
                <TouchableOpacity onPress={onUpdateStock} style={styles.actionBtn}>
                  <Ionicons name="archive-outline" size={22} color={Colors.warning} />
                </TouchableOpacity>
              )}
              {onEdit && (
                <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
                  <Ionicons name="pencil-outline" size={22} color={Colors.primary} />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
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
  category: { fontSize: Typography.size.small, color: Colors.textSecondary, marginTop: 2 },
  price: { fontSize: Typography.size.small, color: Colors.success, marginTop: 2 },
  costPrice: { fontSize: Typography.size.small, color: Colors.textSecondary, marginTop: 2 },
  stockRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: Spacing.sm },
  stock: { fontSize: Typography.size.small, color: Colors.textSecondary },
  lowStock: { color: Colors.danger, fontFamily: Typography.fontFamilySemiBold },
  lowStockBadge: { fontSize: Typography.size.caption, color: Colors.surface, backgroundColor: Colors.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { padding: Spacing.xs },
});