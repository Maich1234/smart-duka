import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversations, getConversation, sendChatMessage } from '@/services/aiChat';

const CONVERSATIONS_KEY = ['aiChat', 'conversations'] as const;
const conversationKey = (id: string) => ['aiChat', 'conversation', id] as const;

/**
 * The single most-recent, non-archived thread — v1 only ever shows one
 * continuous conversation per owner (matches the "brief is proactive, chat
 * is pull-based follow-up" framing, not a multi-thread inbox).
 */
export const useLatestConversation = (enabled: boolean) =>
  useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => getConversations({ limit: 1 }),
    enabled,
    select: (res) => res.data[0] ?? null,
  });

export const useConversationMessages = (conversationId: string | undefined) =>
  useQuery({
    queryKey: conversationId ? conversationKey(conversationId) : conversationKey('none'),
    queryFn: () => getConversation(conversationId as string),
    enabled: !!conversationId,
  });

/**
 * Sends one message. The server returns only the model's turn (not an echo
 * of the user's own message) — the composer is responsible for showing an
 * optimistic local user bubble until this resolves and the thread refetches.
 */
export const useSendChatMessage = (conversationId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => sendChatMessage({ conversationId, message }),
    onSuccess: (response) => {
      const newConversationId = response.data.conversationId;
      queryClient.invalidateQueries({ queryKey: conversationKey(newConversationId) });
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
};
