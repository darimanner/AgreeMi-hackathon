import { apiRequest } from './client';
import type {
  BackendMessage,
  ChatJoinResponse,
  ChatMessagesQuery,
  ChatOut,
  CommandResponse,
  SendMessageInput,
} from './types';

export async function listChatsRequest(): Promise<ChatOut[]> {
  return apiRequest<ChatOut[]>('/chats');
}

export async function createChatRequest(title: string): Promise<ChatOut> {
  return apiRequest<ChatOut>('/chats', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function joinChatRequest(inviteCode: string): Promise<ChatJoinResponse> {
  return apiRequest<ChatJoinResponse>(`/chats/join/${encodeURIComponent(inviteCode)}`, {
    method: 'POST',
  });
}

export async function listMessagesRequest(
  chatId: string,
  query: ChatMessagesQuery = {},
  signal?: AbortSignal
): Promise<BackendMessage[]> {
  return apiRequest<BackendMessage[]>(`/chats/${encodeURIComponent(chatId)}/messages`, {
    query: query as Record<string, string | number | undefined>,
    signal,
  });
}

export async function sendMessageRequest(
  chatId: string,
  payload: SendMessageInput,
  signal?: AbortSignal
): Promise<BackendMessage> {
  const formData = new FormData();
  formData.set('content', payload.content);
  if (payload.file) {
    formData.set('file', payload.file);
  }

  return apiRequest<BackendMessage>(`/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    body: formData,
    signal,
  });
}

export async function runCommandRequest(
  chatId: string,
  command: string,
  signal?: AbortSignal
): Promise<CommandResponse> {
  return apiRequest<CommandResponse>(`/chats/${encodeURIComponent(chatId)}/commands`, {
    method: 'POST',
    body: JSON.stringify({ command }),
    signal,
  });
}
