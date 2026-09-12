import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

/**
 * The footer every scroll-paginated list shows while the next page is on the
 * way. Shared so "there is more coming" looks the same everywhere, rather
 * than each list inventing its own spinner or, worse, showing nothing and
 * leaving the owner wondering whether the list simply ended.
 */
export const ListFooterLoader: React.FC<{ loading: boolean }> = ({ loading }) =>
  loading ? (
    <View style={s.wrap}>
      <ActivityIndicator color={Colors.primary} />
    </View>
  ) : null;

const s = StyleSheet.create({
  wrap: { paddingVertical: Spacing.lg, alignItems: 'center' },
});
