import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface LowStockItem {
  _id: string;
  name: string;
  quantity: number;
  lowStockAlert?: number;
}

interface LowStockListProps {
  items: LowStockItem[];
  onPressItem?: (item: LowStockItem) => void;
}

const PulseWarning = () => {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 800 }),
        withTiming(1, { duration: 800 }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View style={pulseStyle}>
      <Ionicons name="warning" size={16} color="#F59E0B" />
    </Animated.View>
  );
};

export const LowStockList: React.FC<LowStockListProps> = ({ items }) => {
  if (items.length === 0) return null;

  const criticalItems = items.filter((i) => i.quantity <= 2);
  const warningItems = items.filter((i) => i.quantity > 2);

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>SMART ALERTS</Text>
        <View style={styles.alertCountBadge}>
          <PulseWarning />
          <Text style={styles.alertCountText}>{items.length} alert{items.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Summary banner */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryIconWrap}>
          <Ionicons name="cube-outline" size={22} color="#F59E0B" />
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.summaryTitle}>
            {items.length} {items.length === 1 ? 'product is' : 'products are'} running low
          </Text>
          <Text style={styles.summarySubtitle}>
            {criticalItems.length > 0
              ? `${criticalItems.length} critical · restock soon to avoid stockouts`
              : 'Monitor stock levels to prevent lost sales'}
          </Text>
        </View>
      </View>

      {/* Items list */}
      <View style={styles.itemsList}>
        {items.slice(0, 5).map((item, index) => {
          const isCritical = item.quantity <= 2;
          return (
            <Animated.View
              key={item._id}
              entering={FadeInDown.duration(300).delay(300 + index * 50)}
              style={[styles.alertItem, index < Math.min(items.length, 5) - 1 && styles.alertItemBorder]}
            >
              <View
                style={[
                  styles.alertDot,
                  { backgroundColor: isCritical ? '#FEE2E2' : '#FEF3C7' },
                ]}
              >
                <Ionicons
                  name={isCritical ? 'alert-circle' : 'warning-outline'}
                  size={14}
                  color={isCritical ? '#DC2626' : '#F59E0B'}
                />
              </View>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <View
                style={[
                  styles.stockBadge,
                  {
                    backgroundColor: isCritical ? '#FEE2E2' : '#FEF3C7',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stockText,
                    { color: isCritical ? '#DC2626' : '#B45309' },
                  ]}
                >
                  {item.quantity} left
                </Text>
              </View>
            </Animated.View>
          );
        })}
        {items.length > 5 && (
          <View style={styles.moreRow}>
            <Text style={styles.moreText}>+{items.length - 5} more items need attention</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#94A3B8',
    letterSpacing: 1.1,
  },
  alertCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertCountText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#B45309',
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  summaryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
    gap: 3,
  },
  summaryTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#92400E',
  },
  summarySubtitle: {
    fontSize: 11,
    color: '#B45309',
    fontFamily: Typography.fontFamily,
    lineHeight: 16,
  },
  itemsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  alertItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  alertDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#0F172A',
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  stockText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
  },
  moreRow: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  moreText: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: Typography.fontFamily,
  },
});
