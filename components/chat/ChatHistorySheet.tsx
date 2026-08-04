import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ConversationSummary } from '@/services/aiChat';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface ChatHistorySheetProps {
  visible: boolean;
  conversations: ConversationSummary[];
  activeId?: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}

/** "3 Aug", or "Today" / "Yesterday" for the recent ones a cashier cares about. */
function relativeDay(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (date.getTime() >= startOfToday) return 'Today';
  if (date.getTime() >= startOfToday - dayMs) return 'Yesterday';
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

/**
 * Past Dukana AI conversations.
 *
 * The backend has always kept full history; the chat screen just never showed
 * it, so every new chat appeared to destroy the last one. This is the drawer
 * that makes those threads reachable again — no API change was needed.
 */
export const ChatHistorySheet: React.FC<ChatHistorySheetProps> = ({
  visible,
  conversations,
  activeId,
  onClose,
  onSelect,
}) => (
  <BottomSheet visible={visible} onClose={onClose}>
    <View style={styles.sheet}>
      <Text style={styles.title}>Past conversations</Text>

      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            title="No past conversations"
            subtitle="Chats you have with Dukana AI will be listed here."
          />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          style={styles.list}
          renderItem={({ item }) => {
            const isActive = item._id === activeId;
            return (
              <AnimatedPressable
                onPress={() => {
                  onSelect(item._id);
                  onClose();
                }}
                style={[styles.row, isActive && styles.rowActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={item.title ?? 'Untitled conversation'}
              >
                <Ionicons
                  name={isActive ? 'chatbubble' : 'chatbubble-outline'}
                  size={18}
                  color={isActive ? Colors.primary : Colors.textTertiary}
                />
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, isActive && styles.rowTitleActive]} numberOfLines={1}>
                    {item.title ?? 'Untitled conversation'}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {relativeDay(item.lastMessageAt)} · {item.messageCount} message
                    {item.messageCount === 1 ? '' : 's'}
                  </Text>
                </View>
                {isActive && <Text style={styles.currentTag}>Current</Text>}
              </AnimatedPressable>
            );
          }}
        />
      )}
    </View>
  </BottomSheet>
);

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  list: { maxHeight: 420 },
  empty: { paddingVertical: Spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.sm,
    borderRadius: 12,
    minHeight: 56,
  },
  rowActive: { backgroundColor: Colors.primarySubtle },
  rowText: { flex: 1, gap: 3 },
  rowTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  rowTitleActive: { color: Colors.primaryDark },
  rowMeta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },
  currentTag: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
});
