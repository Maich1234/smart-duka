import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Shimmer } from '@/components/ui/Shimmer';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface ListSkeletonProps {
  rows?: number;
  heroHeight?: number;
  showSearch?: boolean;
}

function SkeletonRow({ isLast }: { isLast: boolean }) {
  return (
    <View style={[sk.row, !isLast && sk.rowBorder]}>
      <Shimmer height={38} borderRadius={19} style={{ width: 38 }} />
      <View style={sk.rowBody}>
        <Shimmer height={13} borderRadius={5} style={{ width: '62%', marginBottom: 5 }} />
        <Shimmer height={10} borderRadius={4} style={{ width: '40%' }} />
      </View>
      <View style={sk.rowRight}>
        <Shimmer height={13} borderRadius={5} style={{ width: 52, marginBottom: 4 }} />
        <Shimmer height={10} borderRadius={4} style={{ width: 36 }} />
      </View>
    </View>
  );
}

export function ListSkeleton({ rows = 6, heroHeight = 0, showSearch = false }: ListSkeletonProps) {
  return (
    <View style={sk.container}>
      {/* hero card if present */}
      {heroHeight > 0 && (
        <Shimmer
          height={heroHeight}
          borderRadius={BorderRadius.xl}
          style={sk.heroCard}
        />
      )}

      {/* search bar if present */}
      {showSearch && (
        <Shimmer height={44} borderRadius={BorderRadius.full} style={sk.searchBar} />
      )}

      {/* list card */}
      <View style={sk.listCard}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} isLast={i === rows - 1} />
        ))}
      </View>

      {/* faded second list card hint */}
      <View style={[sk.listCard, { opacity: 0.45 }]}>
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonRow key={i} isLast={i === 1} />
        ))}
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  heroCard: {
    marginBottom: Spacing.md,
  },
  searchBar: {
    marginBottom: Spacing.md,
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowBody: {
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
});
