import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export interface InventoryStats {
  totalProducts: number;
  lowStockCount: number;
  stockoutSoonCount: number;
  totalValue: number;
  /** True when the catalogue has more than one page — low stock / value counts are per-page only. */
  isPageScope?: boolean;
}

interface InventoryStatsRowProps {
  stats: InventoryStats;
}

function useCountUp(target: number, duration = 1100) {
  const [displayed, setDisplayed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (target === 0) {
      setDisplayed(0);
      return;
    }
    startRef.current = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(target * eased));
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);

  return displayed;
}

function formatCompactValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

export const InventoryStatsRow: React.FC<InventoryStatsRowProps> = ({ stats }) => {
  const productsAnim = useCountUp(stats.totalProducts);
  const lowStockAnim = useCountUp(stats.lowStockCount);
  const stockoutAnim = useCountUp(stats.stockoutSoonCount);
  const valueAnim = useCountUp(Math.round(stats.totalValue));

  // When there are multiple pages, low-stock count and value reflect this page only.
  const pageScopeNote = stats.isPageScope ? 'this page' : 'need restock';
  const valueScopeNote = stats.isPageScope ? 'this page' : 'total worth';

  const cards = [
    {
      icon: 'cube' as const,
      label: 'Products',
      value: String(productsAnim),
      sublabel: 'in inventory',
      colors: ['#1E3A5F', '#2563EB'] as readonly [string, string],
      accent: '#93C5FD',
      delay: 0,
    },
    {
      icon: 'warning' as const,
      label: 'Low Stock',
      value: String(lowStockAnim),
      sublabel: pageScopeNote,
      colors: (stats.lowStockCount > 0
        ? ['#78350F', '#D97706']
        : ['#1C1917', '#44403C']) as readonly [string, string],
      accent: stats.lowStockCount > 0 ? '#FCD34D' : '#A8A29E',
      delay: 80,
    },
    {
      icon: 'alert-circle' as const,
      label: 'Stockout Soon',
      value: String(stockoutAnim),
      sublabel: 'predicted',
      colors: (stats.stockoutSoonCount > 0
        ? ['#7F1D1D', '#DC2626']
        : ['#1C1917', '#44403C']) as readonly [string, string],
      accent: stats.stockoutSoonCount > 0 ? '#FCA5A5' : '#A8A29E',
      delay: 160,
    },
    {
      icon: 'wallet' as const,
      label: 'Stock Value',
      value: `KES ${formatCompactValue(valueAnim)}`,
      sublabel: valueScopeNote,
      colors: ['#14532D', '#15803D'] as readonly [string, string],
      accent: '#86EFAC',
      delay: 240,
    },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>INVENTORY OVERVIEW</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={152}
      >
        {cards.map((card) => (
          <Animated.View
            key={card.label}
            entering={FadeInRight.duration(420).delay(card.delay + 200)}
          >
            <LinearGradient
              colors={card.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.cardOrb} />
              <View style={styles.iconWrap}>
                <Ionicons name={card.icon} size={18} color={card.accent} />
              </View>
              <Text style={[styles.cardValue, { color: card.accent }]} numberOfLines={1}>
                {card.value}
              </Text>
              <Text style={styles.cardLabel}>{card.label}</Text>
              <Text style={styles.cardSublabel}>{card.sublabel}</Text>
            </LinearGradient>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#94A3B8',
    letterSpacing: 1.1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: 12,
    paddingRight: Spacing.lg + 4,
  },
  card: {
    width: 140,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  cardOrb: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.07)',
    right: -24,
    top: -24,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardValue: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    marginBottom: 2,
  },
  cardLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: 'rgba(255,255,255,0.92)',
  },
  cardSublabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.48)',
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
});
