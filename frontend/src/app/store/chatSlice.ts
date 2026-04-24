import {
  createChatRequest,
  joinChatRequest,
  listChatsRequest,
  listMessagesRequest,
  runCommandRequest,
  sendMessageRequest,
} from '../../shared/api';
import { isAbortError } from '../../shared/api';
import { normalizeChat, normalizeMessage } from './normalize';
import { abortRequest, finishRequest, startRequest } from './runtime';
import type { AppStoreSlice, ChatSlice } from './types';

export const createChatSlice: AppStoreSlice<ChatSlice> = (set, get) => ({
  chatRooms: [],
  activeChatId: null,
  streamingChatId: null,
  isAiStreaming: false,

  setActiveChat: (chatId) => set({ activeChatId: chatId }),

  leaveChat: (chatId) => {
    abortRequest(`messages:${chatId}`);
    abortRequest(`send:${chatId}`);
    abortRequest(`command:${chatId}`);
    if (get().streamingChatId === chatId) {
      set({ streamingChatId: null, isAiStreaming: false });
    }
  },

  loadChats: async () => {
    try {
      const rooms = await listChatsRequest();
      const currentRooms = get().chatRooms;
      set({
        chatRooms: rooms.map(room => normalizeChat(room, currentRooms.find(existing => existing.id === room.id))),
      });
    } catch {
      // Keep the current in-memory state if the API is temporarily unavailable.
    }
  },

  loadMessages: async (chatId) => {
    const key = `messages:${chatId}`;
    const signal = startRequest(key);

    try {
      const messages = await listMessagesRequest(chatId, {}, signal);
      if (!finishRequest(key, signal)) return;

      set({
        chatRooms: get().chatRooms.map(room =>
          room.id === chatId
            ? {
                ...room,
                messages: messages.map(normalizeMessage),
                lastMessageAt: messages.length > 0
                  ? new Date(messages[messages.length - 1].timestamp ?? messages[messages.length - 1].created_at)
                  : room.lastMessageAt,
              }
          : room
        ),
      });
    } catch (error) {
      if (!isAbortError(error)) {
        finishRequest(key, signal);
      }
      // Keep existing room state.
    }
  },

  createChat: async (title) => {
    const room = await createChatRequest(title);
    const normalized = normalizeChat(room);
    set({ chatRooms: [normalized, ...get().chatRooms], activeChatId: normalized.id });
    return normalized;
  },

  joinChat: async (chatId) => {
    const { currentUser, chatRooms } = get();
    if (!currentUser) return { success: false, error: 'You must be logged in to join a chat' };

    try {
      const result = await joinChatRequest(chatId);
      const normalized = normalizeChat(result.chat, chatRooms.find(r => r.id === result.chat.id));
      set({
        chatRooms: chatRooms.some(r => r.id === normalized.id)
          ? chatRooms.map(r => (r.id === normalized.id ? normalized : r))
          : [normalized, ...chatRooms],
        activeChatId: normalized.id,
      });
      return { success: true, chatId: normalized.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Could not join chat' };
    }
  },

  sendMessage: async (chatId, content, attachments) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const key = `send:${chatId}`;
    const signal = startRequest(key);

    const file = attachments?.[0]?.file;
    try {
      const message = await sendMessageRequest(chatId, { content, file }, signal);
      if (!finishRequest(key, signal)) return;

      const normalized = normalizeMessage(message);
      get().receiveMessage(chatId, normalized);

      if (attachments && attachments.length > 0) {
        await get().runCommand(chatId, '/analyze');
      }
    } catch (error) {
      if (!isAbortError(error)) {
        finishRequest(key, signal);
        throw error;
      }
    }
  },

  runCommand: async (chatId, command) => {
    const key = `command:${chatId}`;
    const signal = startRequest(key);
    set({ streamingChatId: chatId, isAiStreaming: true });

    try {
      const response = await runCommandRequest(chatId, command, signal);
      if (!finishRequest(key, signal)) return;

      const normalized = normalizeMessage(response.message);
      get().receiveMessage(chatId, normalized);

      if (command.trim().toLowerCase().startsWith('/analyze')) {
        await get().loadChats();
      }
    } catch (error) {
      if (!isAbortError(error)) {
        finishRequest(key, signal);
        throw error;
      }
    } finally {
      if (get().streamingChatId === chatId) {
        set({ streamingChatId: null, isAiStreaming: false });
      }
    }
  },

  receiveMessage: (chatId, message) => {
    set({
      chatRooms: get().chatRooms.map(room =>
        room.id === chatId
          ? room.messages.some(existing => existing.id === message.id)
            ? { ...room, lastMessageAt: message.timestamp }
            : {
                ...room,
                messages: [...room.messages, message],
                lastMessageAt: message.timestamp,
              }
          : room
      ),
    });
  },
});
