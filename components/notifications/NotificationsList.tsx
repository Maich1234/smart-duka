import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { NotificationDetailSheet } from './NotificationDetailSheet';
import { iconForType } from './notificationMeta';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '@/services/notificationInbox';
import { haptics } from '@/utils/haptics';
import { formatRelativeTime } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

/** Shared inbox UI rendered by both the owner and staff Notifications screens. */
export const NotificationsList: React.FC = () => {
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  // Kept separate from `detailVisible` so the sheet still has content to
  // render while it slides out (same pattern as SaleDetailsModal).
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const { data, isLoading, isRefetching, refetch, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam = 1 }) => getNotifications({ page: pageParam as number, limit: 20 }),
    getNextPageParam: (last) => (last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined),
    initialPageParam: 1,
  });

  const items = data?.pages.flatMap((p) => p.data) ?? [];
  const unreadCount = items.filter((n) => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id: string) => {
      queryClient.setQueryData(['notifications'], (old: typeof data) =>
        old && {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((n) => (n._id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n)),
          })),
        }
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'unreadCount'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      queryClient.setQueryData(['notifications'], (old: typeof data) =>
        old && {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((n) => (n.read ? n : { ...n, read: true, readAt: new Date().toISOString() })),
          })),
        }
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'unreadCount'] }),
  });

  // Opening the full text is the primary action; marking it read is a
  // side-effect of having read it. Doing only the latter (the old behaviour)
  // made a tap look like it destroyed the thing the user wanted to read,
  // since list rows clamp the title to one line and the body to two.
  const onPressItem = (item: AppNotification) => {
    haptics.light();
    setSelected(item);
    setDetailVisible(true);
    if (!item.read) markReadMutation.mutate(item._id);
  };

  if (isLoading) return <ListSkeleton rows={7} />;

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <AnimatedPressable
          style={styles.markAllRow}
          onPress={() => {
            haptics.medium();
            markAllReadMutation.mutate();
          }}
          accessibilityRole="button"
          accessibilityLabel="Mark all as read"
        >
          <Text style={styles.markAllText}>Mark all as read</Text>
          <Text style={styles.unreadCountText}>{unreadCount} unread</Text>
        </AnimatedPressable>
      )}
      <FlashList
        data={items}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState title="No notifications yet" subtitle="Alerts and updates will show up here." />}
        renderItem={({ item }) => (
          <AnimatedPressable
            style={[styles.row, !item.read && styles.rowUnread]}
            onPress={() => onPressItem(item)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
              <Ionicons
                name={iconForType(item.type)}
                size={18}
                color={item.read ? Colors.textTertiary : Colors.primary}
              />
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
                  {item.title}
                </Text>
                {!item.read && <View style={styles.dot} />}
              </View>
              <Text style={styles.text} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
          </AnimatedPressable>
        )}
      />
      <NotificationDetailSheet
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        notification={selected}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  markAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  markAllText: {
    color: Colors.primary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  unreadCountText: {
    color: Colors.textTertiary,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  rowUnread: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.primarySubtle,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {
    backgroundColor: Colors.surface,
  },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  titleUnread: { color: Colors.textPrimary },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  time: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    marginTop: 4,
  },
});
