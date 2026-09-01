import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { SuggestedPrompts } from '@/components/chat/SuggestedPrompts';
import { UpsellCard, AiDisabledCard } from '@/components/insights/InsightSections';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
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
import { Spacing } from '@/constants/Spacing';

interface DisplayMessage {
  _id: string;
  role: 'user' | 'model';
  text: string;
  toolsUsed?: string[];
}

/**
 * Turns shown from local state because the server hasn't been re-read yet.
 *
 * `sentAt` is the thread's turn count at the moment of sending: once the
 * refetched thread holds that many plus these turns, the server has caught up
 * and the local copies are dropped in the same render the real ones appear.
 * `conversationId` is undefined only for the first message of a new thread,
 * before the server has named it.
 */
interface OptimisticBatch {
  conversationId: string | undefined;
  sentAt: number;
  turns: DisplayMessage[];
}

/**
 * Ask DuQana. Auto-opens the latest non-archived conversation and
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
  // `new` triggers handleNewChat() below on arrival — the Help Center's "Ask
  // DuQana" link (duqana://chat?new=1) uses this so a visitor coming from an
  // old conversation's context always lands on a blank thread, not whatever
  // was last open.
  const { seed, new: newChatParam } = useLocalSearchParams<{ seed?: string; new?: string }>();
  const tabBarHeight = useTabBarHeight();

  // Same gate as /(owner)/insights.tsx — subscription state, plan feature,
  // and the shop's own DuQana AI toggle. Matches the backend's
  // requireActiveSubscription + requireFeature + requireAiEnabled on POST /ai/chat.
  const { hasAiAccess: hasAiChat, state: aiAccessState, isLoading: isSubscriptionLoading } = useAiAccess();
  const { plan } = useSubscription();

  const { alert, toast } = useAlert();

  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(undefined);
  // Set while the owner has explicitly started a fresh thread — blocks the
  // latest-conversation effect below from immediately reloading the old one
  // it still has cached. Cleared once a real conversation id exists again
  // (a message was sent, or a deletion fell back to an older thread).
  const [skipAutoLoad, setSkipAutoLoad] = useState(false);
  const [inputText, setInputText] = useState(typeof seed === 'string' ? seed : '');
  const [optimistic, setOptimistic] = useState<OptimisticBatch | null>(null);
  const listRef = useRef<FlatList<DisplayMessage>>(null);

  // "Ask why" on the Insights screen pushes here with a question in the URL.
  // Chat is a tab route, so arriving a second time re-uses the mounted screen
  // and the `useState` initialiser above never runs again — without this the
  // second tap would land on an empty composer. Applied once per distinct
  // seed so it can't overwrite what the owner is typing on every re-render.
  const appliedSeed = useRef(typeof seed === 'string' ? seed : null);
  useEffect(() => {
    if (typeof seed === 'string' && seed && seed !== appliedSeed.current) {
      appliedSeed.current = seed;
      setInputText(seed);
    }
  }, [seed]);

  const [historyVisible, setHistoryVisible] = useState(false);

  const { data: history, isLoading: isLoadingLatest } = useConversationHistory(hasAiChat);

  // Derived, not synced from an effect: with nothing explicitly selected (and
  // the user hasn't asked for a blank thread) the most recent conversation is
  // the one on screen. The effect version rendered an empty thread for a frame
  // before catching up, which read as "your history is gone".
  const conversationId =
    selectedConversationId ?? (skipAutoLoad ? undefined : history?.latest?._id);

  const { data: thread, isLoading: isLoadingThread } = useConversationMessages(conversationId);
  const sendMutation = useSendChatMessage(conversationId);
  const archiveMutation = useArchiveConversation();

  const persisted: DisplayMessage[] = useMemo(
    () =>
      (thread?.data.messages ?? []).map((m) => ({
        _id: m._id,
        role: m.role,
        text: m.text,
        toolsUsed: m.toolsUsed,
      })),
    [thread]
  );

  // Turns the server holds for this thread, across every page — the count
  // `persisted` is compared against. `persisted.length` can't stand in for it:
  // a thread that spills onto a new page comes back shorter than before.
  const serverTurnCount = thread?.pagination?.total ?? 0;

  // The exchange stays on screen from the moment it is sent until the server's
  // copy replaces it, with no gap in between.
  //
  // Sending used to clear the local user bubble the instant the mutation
  // resolved and wait for an invalidated query to refetch. For a brand-new
  // thread that also swapped in a fresh `conversationId`, so the whole screen
  // fell back to the loading state: the question vanished, the screen blanked,
  // and it read as the chat reloading and losing the message. Both the
  // question and the answer are known locally the moment the reply lands —
  // they are rendered from here until the server has caught up.
  const messages: DisplayMessage[] = useMemo(() => {
    if (!optimistic) return persisted;
    // A batch belongs to the thread it was sent in. Without this check, opening
    // another conversation while one is in flight would append its turns to the
    // wrong transcript.
    const belongsHere =
      optimistic.conversationId === undefined || optimistic.conversationId === conversationId;
    if (!belongsHere) return persisted;
    if (serverTurnCount >= optimistic.sentAt + optimistic.turns.length) return persisted;
    return [...persisted, ...optimistic.turns];
  }, [persisted, optimistic, serverTurnCount, conversationId]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || sendMutation.isPending) return;
    setInputText('');
    const sentAt = serverTurnCount;
    setOptimistic({
      conversationId,
      sentAt,
      turns: [{ _id: `local-user-${sentAt}`, role: 'user', text }],
    });
    sendMutation.mutate(text, {
      onSuccess: (response) => {
        const reply = response.data.message;
        setOptimistic({
          conversationId: response.data.conversationId,
          sentAt,
          turns: [
            { _id: `local-user-${sentAt}`, role: 'user', text },
            {
              _id: `local-model-${sentAt}`,
              role: 'model',
              text: reply.text,
              toolsUsed: reply.toolsUsed,
            },
          ],
        });
        if (!conversationId) {
          setSelectedConversationId(response.data.conversationId);
          setSkipAutoLoad(false);
        }
      },
      onError: (error: any) => {
        // Restore the draft so the owner doesn't lose what they typed.
        setOptimistic(null);
        setInputText(text);
        toast({
          type: 'error',
          message: error?.response?.data?.message || error?.message || 'Could not send your message. Please try again.',
        });
      },
    });
  }, [conversationId, inputText, sendMutation, serverTurnCount, toast]);

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
    setSelectedConversationId(undefined);
    setSkipAutoLoad(true);
    setOptimistic(null);
    setInputText('');
  };

  // Same re-arrival problem the seed effect above solves: chat is a tab
  // route, so a second deep link while it's already mounted wouldn't re-run
  // a useState initializer. Applied once per distinct param value.
  const appliedNewChatParam = useRef<string | null>(null);
  useEffect(() => {
    if (typeof newChatParam === 'string' && newChatParam && newChatParam !== appliedNewChatParam.current) {
      appliedNewChatParam.current = newChatParam;
      handleNewChat();
    }
    // handleNewChat isn't memoized, so it's deliberately omitted — this must
    // only re-run when the param itself changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newChatParam]);

  const handleDelete = () => {
    if (!conversationId || sendMutation.isPending) return;
    const idToDelete = conversationId;
    alert({
      type: 'confirm',
      title: 'Delete this conversation?',
      message: "It will be removed from DuQana AI. This can't be undone.",
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        {
          label: 'Delete',
          variant: 'danger',
          onPress: () => {
            archiveMutation.mutate(idToDelete, {
              onSuccess: () => {
                setSelectedConversationId(undefined);
                setSkipAutoLoad(false);
                setOptimistic(null);
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

  // Both gate states are still pushed screens, so they carry the same header
  // and clear the same tab bar as the thread itself.
  if (isSubscriptionLoading) {
    return (
      <Screen scroll={false} padded={false} edges={['left', 'right']} tabBarSpacing>
        <ScreenHeader title="Ask DuQana" fallbackHref="/(owner)/dashboard" />
        <LoadingState />
      </Screen>
    );
  }

  if (!hasAiChat) {
    return (
      <Screen scroll={false} padded={false} edges={['left', 'right']} tabBarSpacing>
        <ScreenHeader title="Ask DuQana" fallbackHref="/(owner)/dashboard" />
        <View style={s.upsellContent}>
          {aiAccessState === 'disabled' ? <AiDisabledCard /> : <UpsellCard />}
        </View>
      </Screen>
    );
  }

  // Sending before the thread's own turn count has arrived would make the
  // optimistic batch clear against a stale total and blink the message away.
  const isThreadSyncing = isLoadingLatest || (!!conversationId && isLoadingThread);

  // Never blank the thread while there is something to show: mid-send the
  // optimistic turns are the only copy of the exchange, and swapping them for
  // a spinner is what made a successful send look like a failed reload.
  const showThreadLoading = messages.length === 0 && isThreadSyncing;

  return (
    <Screen
      scroll={false}
      padded={false}
      edges={['left', 'right']}
      // The tab bar floats over the screen, so the composer has to be lifted
      // clear of it — it used to sit directly underneath, flush against the tabs.
      contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.sm }}
    >
      <StatusBar style="dark" />
      <ScreenHeader
        title="Ask DuQana"
        subtitle="Grounded answers about your business"
        fallbackHref="/(owner)/dashboard"
        right={
          <>
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
          </>
        }
      />

      {showThreadLoading ? (
        <LoadingState />
      ) : messages.length === 0 ? (
        <ScrollView
          style={s.list}
          contentContainerStyle={s.emptyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <EmptyState
            title="Ask anything about your business"
            subtitle="DuQana reads your own sales, stock and expenses to answer."
          />
          <SuggestedPrompts onSelect={setInputText} />
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          style={s.list}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <MessageBubble role={item.role} text={item.text} toolsUsed={item.toolsUsed} />}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={sendMutation.isPending ? <TypingIndicator /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <ChatComposer
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        disabled={sendMutation.isPending || isThreadSyncing}
      />

      <ChatHistorySheet
        visible={historyVisible}
        conversations={history?.conversations ?? []}
        activeId={conversationId}
        onClose={() => setHistoryVisible(false)}
        onSelect={(id) => {
          // Picking a thread cancels any pending "new chat" state, otherwise
          // the auto-load effect would fight the explicit choice.
          setSkipAutoLoad(false);
          setOptimistic(null);
          setSelectedConversationId(id);
        }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  headerBtn: { padding: 4 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  emptyContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.lg },
  upsellContent: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
});
