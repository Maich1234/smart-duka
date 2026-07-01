import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Shimmer } from '@/components/ui/Shimmer';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

function SkeletonSectionHeader() {
  return (
    <View style={sk.sectionHeader}>
      <Shimmer height={28} borderRadius={BorderRadius.sm} style={{ width: 28 }} />
      <View style={{ flex: 1 }}>
        <Shimmer height={14} borderRadius={6} style={{ width: '45%', marginBottom: 4 }} />
        <Shimmer height={10} borderRadius={4} style={{ width: '65%' }} />
      </View>
    </View>
  );
}

function SkeletonListRows({ count = 3 }: { count?: number }) {
  return (
    <View style={sk.listCard}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[sk.listRow, i < count - 1 && sk.listRowBorder]}>
          <Shimmer height={36} borderRadius={18} style={{ width: 36 }} />
          <View style={{ flex: 1 }}>
            <Shimmer height={13} borderRadius={5} style={{ width: '60%', marginBottom: 5 }} />
            <Shimmer height={10} borderRadius={4} style={{ width: '40%' }} />
          </View>
          <View style={sk.listRowRight}>
            <Shimmer height={13} borderRadius={5} style={{ width: 56, marginBottom: 4 }} />
            <Shimmer height={10} borderRadius={4} style={{ width: 36 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ReportsSkeleton() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <ScrollView
      style={sk.root}
      contentContainerStyle={[
        sk.content,
        { paddingTop: insets.top + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* page header */}
      <Shimmer height={32} borderRadius={8} style={{ width: '40%', marginBottom: 6 }} />
      <Shimmer height={13} borderRadius={5} style={{ width: '68%', marginBottom: Spacing.lg }} />

      {/* period control */}
      <Shimmer height={46} borderRadius={BorderRadius.xl} style={{ marginBottom: Spacing.md }} />

      {/* hero card */}
      <Shimmer height={228} borderRadius={BorderRadius.xl} style={{ marginBottom: Spacing.md }} />

      {/* breakdown card */}
      <Shimmer height={108} borderRadius={BorderRadius.lg} style={{ marginBottom: Spacing.md }} />

      {/* insight cards */}
      <SkeletonSectionHeader />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sk.insightRow}
        pointerEvents="none"
      >
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} height={112} borderRadius={BorderRadius.lg} style={{ width: 148 }} />
        ))}
      </ScrollView>

      <View style={sk.gap} />

      {/* peak activity */}
      <SkeletonSectionHeader />
      <Shimmer height={160} borderRadius={BorderRadius.lg} style={{ marginBottom: Spacing.lg }} />

      {/* divider label */}
      <Shimmer height={10} borderRadius={4} style={{ width: '45%', alignSelf: 'center', marginBottom: Spacing.lg }} />

      {/* top products */}
      <SkeletonSectionHeader />
      <SkeletonListRows count={3} />

      <View style={sk.gap} />

      {/* staff */}
      <SkeletonSectionHeader />
      <SkeletonListRows count={2} />

      <View style={sk.gap} />

      {/* ratings */}
      <SkeletonSectionHeader />
      <Shimmer height={140} borderRadius={BorderRadius.lg} />
    </ScrollView>
  );
}

const sk = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  insightRow: { gap: Spacing.sm, paddingRight: Spacing.xs, marginBottom: Spacing.sm },
  gap: { height: Spacing.lg },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.sm,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  listRowRight: { alignItems: 'flex-end' },
});
