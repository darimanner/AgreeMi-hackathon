import {
  createChatRequest,
  joinChatRequest,
  listChatsRequest,
  listMessagesRequest,
  runCommandRequest,
  sendMessageRequest,
} from '../../shared/api';
import { isAbortError } from '../../shared/api';
import { normalizeAnalysis, normalizeChat, normalizeMessage } from './normalize';
import { abortRequest, finishRequest, startRequest } from './runtime';
import type { AppStoreSlice, ChatSlice } from './types';
import type { ChatRoom, Message } from '../../shared/types';

function createOptimisticId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendMessage(rooms: ChatRoom[], chatId: string, message: Message) {
  return rooms.map(room =>
    room.id === chatId
      ? {
          ...room,
          messages: dedupeMessages([...room.messages, message]),
          lastMessageAt: message.timestamp,
        }
      : room
  );
}

function replaceMessage(rooms: ChatRoom[], chatId: string, targetId: string, message: Message) {
  return rooms.map(room =>
    room.id === chatId ? {
      ...room,
      messages: replaceMessageInList(room.messages, targetId, message),
      lastMessageAt: message.timestamp,
    } : room
  );
}

function patchMessage(rooms: ChatRoom[], chatId: string, targetId: string, patch: Partial<Message>) {
  return rooms.map(room =>
    room.id === chatId
      ? {
          ...room,
          messages: room.messages.map(existing => (existing.id === targetId ? { ...existing, ...patch } : existing)),
        }
      : room
  );
}

function removeMessage(rooms: ChatRoom[], chatId: string, targetId: string) {
  return rooms.map(room =>
    room.id === chatId
      ? { ...room, messages: room.messages.filter(message => message.id !== targetId) }
      : room
  );
}

function normalizeComparableContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ');
}

function isOptimisticMessage(message: Message): boolean {
  return message.id.startsWith('optimistic-');
}

function isSameLogicalMessage(left: Message, right: Message): boolean {
  if (left.id === right.id) return true;
  if (left.clientMessageId && left.clientMessageId === right.clientMessageId) return true;
  if (left.role !== right.role) return false;
  if (normalizeComparableContent(left.content) !== normalizeComparableContent(right.content)) return false;
  if (left.authorId !== right.authorId && !left.id.startsWith('optimistic-') && !right.id.startsWith('optimistic-')) return false;

  return Math.abs(left.timestamp.getTime() - right.timestamp.getTime()) < 20_000;
}

function shouldReplaceExistingMessage(existing: Message, incoming: Message): boolean {
  if (existing.id === incoming.id) return true;
  if (existing.clientMessageId && existing.clientMessageId === incoming.clientMessageId) return true;
  if (existing.status === 'sending' && isSameLogicalMessage(existing, incoming)) return true;
  return isOptimisticMessage(existing) && !isOptimisticMessage(incoming) && isSameLogicalMessage(existing, incoming);
}

function dedupeMessages(messages: Message[]): Message[] {
  return messages.reduce<Message[]>((acc, message) => {
    const existingIndex = acc.findIndex(existing => shouldReplaceExistingMessage(existing, message));

    if (existingIndex >= 0) {
      const existing = acc[existingIndex];
      const nextMessage = isOptimisticMessage(message) && !isOptimisticMessage(existing)
        ? existing
        : message;
      acc[existingIndex] = nextMessage;
      return acc;
    }

    return [...acc, message];
  }, []);
}

function replaceMessageInList(messages: Message[], targetId: string, message: Message): Message[] {
  let inserted = false;
  const next = messages.reduce<Message[]>((acc, existing) => {
    const shouldReplace = existing.id === targetId || shouldReplaceExistingMessage(existing, message);

    if (shouldReplace) {
      if (!inserted) {
        inserted = true;
        return [...acc, message];
      }
      return acc;
    }

    return [...acc, existing];
  }, []);

  return dedupeMessages(inserted ? next : [...next, message]);
}

function mergeServerAndOptimisticMessages(serverMessages: Message[], optimisticMessages: Message[]): Message[] {
  return dedupeMessages([
    ...serverMessages,
    ...optimisticMessages.filter(optimistic =>
      optimistic.status === 'failed'
      || !serverMessages.some(serverMessage => isSameLogicalMessage(optimistic, serverMessage))
    ),
  ]);
}

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
      const normalizedMessages = messages.map(normalizeMessage);
      const optimisticMessages = get().chatRooms
        .find(room => room.id === chatId)
        ?.messages.filter(message => message.status === 'sending' || message.status === 'failed') ?? [];
      const mergedMessages = mergeServerAndOptimisticMessages(normalizedMessages, optimisticMessages);
      set({
        chatRooms: get().chatRooms.map(room =>
          room.id === chatId
            ? {
                ...room,
                messages: mergedMessages,
                lastMessageAt: messages.length > 0
                  ? new Date(messages[messages.length - 1].timestamp ?? messages[messages.length - 1].created_at)
                  : room.lastMessageAt,
              }
          : room
        ),
      });

      // If the room has no aiAnalysis (e.g. on a fresh device with no localStorage),
      // fetch the full chat list so the server's ai_analysis_json is pulled in.
      const roomAfterLoad = get().chatRooms.find(room => room.id === chatId);
      if (!roomAfterLoad?.aiAnalysis) {
        await get().loadChats();
      }
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
    const optimisticId = createOptimisticId('optimistic-user');
    const optimisticMessage: Message = {
      id: optimisticId,
      clientMessageId: optimisticId,
      chatId,
      authorId: currentUser.id,
      role: currentUser.role,
      content,
      attachments,
      timestamp: new Date(),
      status: 'sending',
    };

    set({ chatRooms: appendMessage(get().chatRooms, chatId, optimisticMessage) });

    const file = attachments?.[0]?.file;
    try {
      const message = await sendMessageRequest(chatId, { content, file }, signal);
      if (!finishRequest(key, signal)) return;

      const normalized = normalizeMessage(message);
      set({ chatRooms: replaceMessage(get().chatRooms, chatId, optimisticId, normalized) });

      if (attachments && attachments.length > 0) {
        await get().runCommand(chatId, '/analyze');
      }
    } catch (error) {
      if (!isAbortError(error)) {
        finishRequest(key, signal);
        set({ chatRooms: patchMessage(get().chatRooms, chatId, optimisticId, { status: 'failed' }) });
        throw error;
      }
      set({ chatRooms: removeMessage(get().chatRooms, chatId, optimisticId) });
    }
  },

  runCommand: async (chatId, command) => {
    const key = `command:${chatId}`;
    const signal = startRequest(key);
    const aiPlaceholderId = createOptimisticId('optimistic-ai');
    set({ streamingChatId: chatId, isAiStreaming: true });
    set({
      chatRooms: appendMessage(get().chatRooms, chatId, {
        id: aiPlaceholderId,
        clientMessageId: aiPlaceholderId,
        chatId,
        authorId: 'ai',
        role: 'ai',
        content: command.trim().toLowerCase().startsWith('/analyze')
          ? 'Analyzing the document…'
          : 'Working on it…',
        timestamp: new Date(),
        isStreaming: true,
        status: 'sending',
      }),
    });

    try {
      const response = await runCommandRequest(chatId, command, signal);
      if (!finishRequest(key, signal)) return;

      const normalized = normalizeMessage(response.message);
      set({ chatRooms: replaceMessage(get().chatRooms, chatId, aiPlaceholderId, normalized) });

      if (command.trim().toLowerCase().startsWith('/analyze')) {
        const analysis = normalizeAnalysis(response.analysis);
        if (analysis) {
          set({
            chatRooms: get().chatRooms.map(room =>
              room.id === chatId ? { ...room, aiAnalysis: analysis } : room
            ),
          });
        } else {
          await get().loadChats();
        }
      }
    } catch (error) {
      if (!isAbortError(error)) {
        finishRequest(key, signal);
        set({ chatRooms: patchMessage(get().chatRooms, chatId, aiPlaceholderId, {
          content: 'AI response failed. Try again in a moment.',
          isStreaming: false,
          status: 'failed',
        }) });
        throw error;
      }
      set({ chatRooms: removeMessage(get().chatRooms, chatId, aiPlaceholderId) });
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
          ? {
              ...room,
              messages: replaceMessageInList(room.messages, message.id, message),
              lastMessageAt: message.timestamp,
            }
          : room
      ),
    });
  },
});
