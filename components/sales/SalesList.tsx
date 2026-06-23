import React from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SaleCard } from './SaleCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spacing } from '@/constants/Spacing';

interface SalesListProps {
  sales: any[];
  isLoading: boolean;
  onRefresh: () => void;
  onPressSale: (sale: any) => void;
  showStaff?: boolean;
  /** Called when the user scrolls near the end of the list — fetch the next page here. */
  onEndReached?: () => void;
  /** Whether the next page is currently being fetched (shows a footer spinner). */
  isFetchingNextPage?: boolean;
}

export const SalesList: React.FC<SalesListProps> = ({
  sales,
  isLoading,
  onRefresh,
  onPressSale,
  showStaff = false,
  onEndReached,
  isFetchingNextPage = false,
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
      renderItem={({ item, index }) => (
        <SaleCard
          sale={item}
          showStaff={showStaff}
          isLast={index === sales.length - 1}
          onPress={() => onPressSale(item)}
        />
      )}
      contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: tabBarHeight + Spacing.lg }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      ListEmptyComponent={<EmptyState title="No sales found" />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <LoadingState fullscreen={false} size={48} /> : null}
    />
  );
};