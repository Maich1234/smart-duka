import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { UpsellCard, AiDisabledCard } from '@/components/insights/InsightSections';
import { useAiAccess } from '@/hooks/useAiAccess';
import { useSubscription } from '@/hooks/useSubscription';
import { useAlert } from '@/context/AlertContext';
import {
  useConversationHistory,
  useConversationMessages,
  useSendChatMessage,
  useArchiveConversation,
} from '@/hooks/useAiChat';
import { ChatHistorySheet } from '@/components/chat/ChatHistorySheet';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface DisplayMessage {
  _id: string;
  role: 'user' | 'model';
  text: string;
  toolsUsed?: string[];
}

/**
 * Ask Smart Duka. Auto-opens the latest non-archived conversation and
 * auto-creates one on the first message.
 *
 * Past threads are reachable from the history sheet. They previously were
 * not: the screen fetched only the newest conversation and starting a new
 * chat made the old one unreachable, which owners read as the app having
 * deleted their history — and the plan-cap message told them to "delete an
 * old one" when none were visible. The backend always stored and paginated
 * the full list, so this needed no API change.
 */
export default function AiChatScreen() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const tabBarHeight = useBottomTabBarHeight();

  // Same gate as /(owner)/insights.tsx — subscription state, plan feature,
  // and the shop's own Smart Duka AI toggle. Matches the backend's
  // requireActiveSubscription + requireFeature + requireAiEnabled on POST /ai/chat.
  const { hasAiAccess: hasAiChat, state: aiAccessState, isLoading: isSubscriptionLoading } = useAiAccess();
  const { plan } = useSubscription();

  const { alert, toast } = useAlert();

  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  // Set while the owner has explicitly started a fresh thread — blocks the
  // latest-conversation effect below from immediately reloading the old one
  // it still has cached. Cleared once a real conversation id exists again
  // (a message was sent, or a deletion fell back to an older thread).
  const [skipAutoLoad, setSkipAutoLoad] = useState(false);
  const [inputText, setInputText] = useState(typeof seed === 'string' ? seed : '');
  const [pendingText, setPendingText] = useState<string | null>(null);
  const listRef = useRef<FlatList<DisplayMessage>>(null);

  const [historyVisible, setHistoryVisible] = useState(false);

  const { data: history, isLoading: isLoadingLatest } = useConversationHistory(hasAiChat);
  useEffect(() => {
    if (!conversationId && !skipAutoLoad && history?.latest?._id) setConversationId(history.latest._id);
  }, [history, conversationId, skipAutoLoad]);

  const { data: thread, isLoading: isLoadingThread } = useConversationMessages(conversationId);
  const sendMutation = useSendChatMessage(conversationId);
  const archiveMutation = useArchiveConversation();

  // The API only returns the model's turn per exchange — a local optimistic
  // bubble stands in for the user's own message until the mutation resolves
  // and the thread refetches with the persisted version.
  const messages: DisplayMessage[] = useMemo(() => {
    const persisted: DisplayMessage[] = (thread?.data.messages ?? []).map((m) => ({
      _id: m._id,
      role: m.role,
      text: m.text,
      toolsUsed: m.toolsUsed,
    }));
    if (pendingText) persisted.push({ _id: 'pending', role: 'user', text: pendingText });
    return persisted;
  }, [thread, pendingText]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || sendMutation.isPending) return;
    setInputText('');
    setPendingText(text);
    sendMutation.mutate(text, {
      onSuccess: (response) => {
        setPendingText(null);
        if (!conversationId) {
          setConversationId(response.data.conversationId);
          setSkipAutoLoad(false);
        }
      },
      onError: (error: any) => {
        // Restore the draft so the owner doesn't lose what they typed.
        setPendingText(null);
        setInputText(text);
        toast({
          type: 'error',
          message: error?.response?.data?.message || error?.message || 'Could not send your message. Please try again.',
        });
      },
    });
  };

  const handleNewChat = () => {
    if (sendMutation.isPending) return;
    const maxConversations = plan?.chatLimits?.maxConversations;
    if (maxConversations != null && (history?.totalConversations ?? 0) >= maxConversations) {
      toast({
        type: 'info',
        message: `Your plan allows up to ${maxConversations} conversation${maxConversations === 1 ? '' : 's'}. Open Past conversations to delete one, or move to a bigger plan.`,
      });
      return;
    }
    setConversationId(undefined);
    setSkipAutoLoad(true);
    setPendingText(null);
    setInputText('');
  };

  const handleDelete = () => {
    if (!conversationId || sendMutation.isPending) return;
    const idToDelete = conversationId;
    alert({
      type: 'confirm',
      title: 'Delete this conversation?',
      message: "It will be removed from Smart Duka AI. This can't be undone.",
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        {
          label: 'Delete',
          variant: 'danger',
          onPress: () => {
            archiveMutation.mutate(idToDelete, {
              onSuccess: () => {
                setConversationId(undefined);
                setSkipAutoLoad(false);
                setPendingText(null);
                setInputText('');
              },
              onError: (error: any) => {
                toast({
                  type: 'error',
                  message: error?.response?.data?.message || 'Could not delete this conversation. Please try again.',
                });
              },
            });
          },
        },
      ],
    });
  };

  if (isSubscriptionLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }

  if (!hasAiChat) {
    return (
      <Screen contentContainerStyle={s.upsellContent}>
        {aiAccessState === 'disabled' ? <AiDisabledCard /> : <UpsellCard />}
      </Screen>
    );
  }

  const showThreadLoading = isLoadingLatest || (!!conversationId && isLoadingThread);

  return (
    <Screen scroll={false} padded={false} edges={['top', 'left', 'right']} contentContainerStyle={{ paddingBottom: tabBarHeight }}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <View style={s.headerText}>
          <Text style={s.title}>Ask Smart Duka</Text>
          <Text style={s.subtitle}>Grounded answers about your business</Text>
        </View>
        <View style={s.headerActions}>
          {(history?.conversations.length ?? 0) > 0 && (
            <AnimatedPressable
              onPress={() => setHistoryVisible(true)}
              style={s.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Past conversations"
            >
              <Ionicons name="time-outline" size={22} color={Colors.textPrimary} />
            </AnimatedPressable>
          )}
          <AnimatedPressable
            onPress={handleNewChat}
            style={s.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Start a new conversation"
          >
            <Ionicons name="add-circle-outline" size={22} color={Colors.textPrimary} />
          </AnimatedPressable>
          {conversationId ? (
            <AnimatedPressable
              onPress={handleDelete}
              style={s.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Delete this conversation"
            >
              <Ionicons name="trash-outline" size={20} color={Colors.textPrimary} />
            </AnimatedPressable>
          ) : null}
        </View>
      </View>

      {showThreadLoading ? (
        <LoadingState />
      ) : messages.length === 0 ? (
        <View style={s.emptyWrap}>
          <EmptyState
            title="Ask anything about your business"
            subtitle={'Try "When is my shop busiest?" or "How are my staff doing this month?"'}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={s.list}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <MessageBubble role={item.role} text={item.text} toolsUsed={item.toolsUsed} />}
          contentContainerStyle={s.listContent}
          ListFooterComponent={sendMutation.isPending ? <TypingIndicator /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <ChatComposer value={inputText} onChangeText={setInputText} onSend={handleSend} disabled={sendMutation.isPending} />

      <ChatHistorySheet
        visible={historyVisible}
        conversations={history?.conversations ?? []}
        activeId={conversationId}
        onClose={() => setHistoryVisible(false)}
        onSelect={(id) => {
          // Picking a thread cancels any pending "new chat" state, otherwise
          // the auto-load effect would fight the explicit choice.
          setSkipAutoLoad(false);
          setPendingText(null);
          setConversationId(id);
        }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerText: { flex: 1, gap: 3 },
  headerActions: { flexDirection: 'row', gap: Spacing.xs, marginLeft: Spacing.sm },
  headerBtn: { padding: 4 },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, letterSpacing: -0.4 },
  subtitle: { fontSize: Typography.size.small, fontFamily: Typography.fontFamily, color: Colors.textSecondary },
  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  upsellContent: { flex: 1, justifyContent: 'center' },
});
