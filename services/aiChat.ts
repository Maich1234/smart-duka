import api from './api';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  toolsUsed?: string[];
  createdAt: string;
}

export interface SendChatMessageData {
  conversationId: string;
  message: ChatMessage;
  source: 'gemini' | 'fallback' | 'error';
}

export interface ConversationSummary {
  _id: string;
  title: string | null;
  lastMessageAt: string;
  messageCount: number;
  createdAt: string;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: (ChatMessage & { _id: string })[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: { page: number; limit: number; total: number; pages: number };
}

/**
 * POST /ai/chat — a non-streaming turn can realistically take several
 * seconds (up to 5 Gemini calls server-side for a multi-round tool-calling
 * question), so this overrides the shared 12s instance default rather than
 * risk misreading a slow-but-successful answer as a network failure.
 */
export const sendChatMessage = async (params: { conversationId?: string; message: string }): Promise<ApiResponse<SendChatMessageData>> => {
  try {
    const response = await api.post('/ai/chat', params, { timeout: 30000 });
    return response.data;
  } catch (err: any) {
    if (err?.code === 'ECONNABORTED') {
      throw { message: 'Smart Duka AI is taking longer than usual. Please try again.' };
    }
    throw err;
  }
};

export const getConversations = async (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<ConversationSummary[]>> => {
  const response = await api.get('/ai/chat/conversations', { params });
  return response.data;
};

export const getConversation = async (id: string, params?: { page?: number; limit?: number }): Promise<ApiResponse<ConversationDetail>> => {
  const response = await api.get(`/ai/chat/conversations/${id}`, { params });
  return response.data;
};

export const archiveConversation = async (id: string): Promise<ApiResponse<null>> => {
  const response = await api.delete(`/ai/chat/conversations/${id}`);
  return response.data;
};
