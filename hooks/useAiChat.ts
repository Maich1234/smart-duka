import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversations, getConversation, sendChatMessage, archiveConversation } from '@/services/aiChat';

const CONVERSATIONS_KEY = ['aiChat', 'conversations'] as const;
const conversationKey = (id: string) => ['aiChat', 'conversation', id] as const;

/**
 * The single most-recent, non-archived thread — v1 only ever shows one
 * continuous conversation per owner (matches the "brief is proactive, chat
 * is pull-based follow-up" framing, not a multi-thread inbox). Also surfaces
 * the total non-archived conversation count (from the list endpoint's own
 * pagination) so the screen can pre-empt the plan's conversation cap
 * client-side, without a dedicated count endpoint.
 */
export const useLatestConversation = (enabled: boolean) =>
  useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => getConversations({ limit: 1 }),
    enabled,
    select: (res) => ({ conversation: res.data[0] ?? null, totalConversations: res.pagination.total }),
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

/** Soft-deletes (archives) a conversation and drops it from the list/detail caches. */
export const useArchiveConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveConversation(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      queryClient.removeQueries({ queryKey: conversationKey(id) });
    },
  });
};
