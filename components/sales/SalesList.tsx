import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SaleCard } from './SaleCard';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface SalesListProps {
  sales: any[];
  isLoading: boolean;
  onRefresh: () => void;
  onPressSale: (sale: any) => void;
  showStaff?: boolean;
}

export const SalesList: React.FC<SalesListProps> = ({
  sales,
  isLoading,
  onRefresh,
  onPressSale,
  showStaff = false,
}) => {
  const tabBarHeight = useBottomTabBarHeight();

  if (isLoading && sales.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      data={sales}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => (
        <SaleCard sale={item} showStaff={showStaff} onPress={() => onPressSale(item)} />
      )}
      contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No sales found</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  emptyContainer: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: Typography.size.body, color: Colors.textSecondary },
});