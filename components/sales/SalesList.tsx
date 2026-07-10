import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { SaleCard } from './SaleCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spacing } from '@/constants/Spacing';

interface SalesListProps {
  sales: any[];
  isLoading: boolean;
  onRefresh: () => void;
  onPressSale: (sale: any) => void;
  currency?: string;
  showStaff?: boolean;
  onEndReached?: () => void;
  isFetchingNextPage?: boolean;
  listHeader?: React.ReactElement;
}

export const SalesList: React.FC<SalesListProps> = ({
  sales,
  isLoading,
  onRefresh,
  onPressSale,
  currency,
  showStaff = false,
  onEndReached,
  isFetchingNextPage = false,
  listHeader,
}) => {
  const tabBarHeight = useBottomTabBarHeight();

  if (isLoading && sales.length === 0) {
    return <LoadingState fullscreen={false} />;
  }

  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      data={sales}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => (
        <SaleCard
          sale={item}
          currency={currency}
          showStaff={showStaff}
          onPress={() => onPressSale(item)}
        />
      )}
      ListHeaderComponent={listHeader}
      contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: tabBarHeight + Spacing.lg }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      ListEmptyComponent={<EmptyState title="No sales found" />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <LoadingState fullscreen={false} size={48} /> : null}
    />
  );
};
