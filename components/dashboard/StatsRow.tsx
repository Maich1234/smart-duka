import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';

interface StatsRowProps {
  products: number;
  stockValue: number;
  lowStockCount: number;
}

interface InsightCardData {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sublabel?: string;
  colors: readonly [string, string, ...string[]];
  delay: number;
  accent?: string;
}

export const StatsRow: React.FC<StatsRowProps> = ({ products, stockValue, lowStockCount }) => {
  const cards: InsightCardData[] = [
    {
      icon: 'cube',
      label: 'Products',
      value: String(products),
      sublabel: 'in inventory',
      colors: ['#1E3A5F', '#2563EB'],
      delay: 0,
      accent: '#93C5FD',
    },
    {
      icon: 'wallet',
      label: 'Stock Value',
      value: formatCurrency(stockValue),
      sublabel: 'total worth',
      colors: ['#14532D', '#15803D'],
      delay: 80,
      accent: '#86EFAC',
    },
    {
      icon: 'warning',
      label: 'Low Stock',
      value: String(lowStockCount),
      sublabel: lowStockCount === 1 ? 'item needs restock' : 'items need restock',
      colors: lowStockCount > 0 ? ['#7F1D1D', '#DC2626'] : ['#1C1917', '#44403C'],
      delay: 160,
      accent: lowStockCount > 0 ? '#FCA5A5' : '#A8A29E',
    },
    {
      icon: 'trending-up',
      label: 'Growth',
      value: '—',
      sublabel: 'vs last week',
      colors: ['#312E81', '#6366F1'],
      delay: 240,
      accent: '#C7D2FE',
    },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>BUSINESS INSIGHTS</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={148}
      >
        {cards.map((card, index) => (
          <Animated.View
            key={card.label}
            entering={FadeInRight.duration(400).delay(card.delay + 300)}
          >
            <LinearGradient
              colors={card.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.insightCard}
            >
              {/* Background orb */}
              <View style={styles.cardOrb} />

              <View style={styles.cardIconWrap}>
                <Ionicons name={card.icon} size={18} color={card.accent ?? '#fff'} />
              </View>
              <Text style={[styles.cardValue, { color: card.accent ?? '#fff' }]}>
                {card.value}
              </Text>
              <Text style={styles.cardLabel}>{card.label}</Text>
              {card.sublabel ? (
                <Text style={styles.cardSublabel}>{card.sublabel}</Text>
              ) : null}
            </LinearGradient>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
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
  insightCard: {
    width: 136,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  cardOrb: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.07)',
    right: -20,
    top: -20,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardValue: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: '#fff',
    marginBottom: 2,
  },
  cardLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: 'rgba(255,255,255,0.9)',
  },
  cardSublabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
});
