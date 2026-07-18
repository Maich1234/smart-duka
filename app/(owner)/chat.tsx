import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { Screen } from '@/components/ui/Screen';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { UpsellCard } from '@/components/insights/InsightSections';
import { useSubscription } from '@/hooks/useSubscription';
import { useLatestConversation, useConversationMessages, useSendChatMessage } from '@/hooks/useAiChat';
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
 * Single continuous thread per owner — v1 auto-opens the latest
 * non-archived conversation and auto-creates one on first message, rather
 * than a multi-thread list screen (the backend's list/archive endpoints
 * already exist for that later without an API change).
 */
export default function AiChatScreen() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const tabBarHeight = useBottomTabBarHeight();

  const { access, isLoading: isSubscriptionLoading } = useSubscription();
  // Same gate as /(owner)/insights.tsx — any active subscription (trial,
  // paid, or grace), no plan-tier distinction. Matches the backend's
  // requireActiveSubscription on POST /ai/chat.
  const hasAiChat = access?.state === 'trialing' || access?.state === 'active' || access?.state === 'grace';

  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [inputText, setInputText] = useState(typeof seed === 'string' ? seed : '');
  const [pendingText, setPendingText] = useState<string | null>(null);
  const listRef = useRef<FlatList<DisplayMessage>>(null);

  const { data: latest, isLoading: isLoadingLatest } = useLatestConversation(hasAiChat);
  useEffect(() => {
    if (!conversationId && latest?._id) setConversationId(latest._id);
  }, [latest, conversationId]);

  const { data: thread, isLoading: isLoadingThread } = useConversationMessages(conversationId);
  const sendMutation = useSendChatMessage(conversationId);

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
        if (!conversationId) setConversationId(response.data.conversationId);
      },
      onError: () => {
        // Restore the draft so the owner doesn't lose what they typed.
        setPendingText(null);
        setInputText(text);
      },
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
        <UpsellCard />
      </Screen>
    );
  }

  const showThreadLoading = isLoadingLatest || (!!conversationId && isLoadingThread);

  return (
    <Screen scroll={false} padded={false} edges={['top', 'left', 'right']} contentContainerStyle={{ paddingBottom: tabBarHeight }}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <Text style={s.title}>Ask Smart Duka</Text>
        <Text style={s.subtitle}>Grounded answers about your business</Text>
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
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: 3 },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, letterSpacing: -0.4 },
  subtitle: { fontSize: Typography.size.small, fontFamily: Typography.fontFamily, color: Colors.textSecondary },
  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  upsellContent: { flex: 1, justifyContent: 'center' },
});
