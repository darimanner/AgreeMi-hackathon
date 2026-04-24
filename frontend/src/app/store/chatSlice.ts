import type { Message } from '../../shared/types';
import { MOCK_AI_ANALYSIS, MOCK_CHATS } from './mockData';
import type { AppStoreSlice, ChatSlice } from './types';

function getAiCommandResponse(command: string): string {
  const cmd = command.trim().toLowerCase();

  if (cmd === '/update' || cmd.startsWith('/update')) {
    return `🔄 **Project Status Update**\n\nBased on the conversation history:\n\n- **Completed:** Initial spec review, performance requirements discussion\n- **In Progress:** Clarifying timeline and SLA definitions\n- **Blocked:** Awaiting client sign-off on updated requirements\n\n📊 **Current spec quality score:** 62/100\n\n_Use \`/update\` anytime to get a fresh summary._`;
  }

  if (cmd === '/analyze') {
    return `🤖 **File analyzed!** I've reviewed the attachment and updated the sidebar with my findings.\n\nKey observations:\n- **3 issues found** (1 critical, 1 warning, 1 info)\n- Overall quality score: **62/100**\n\nClick the sidebar panel ↗ for details.`;
  }

  if (cmd === '/help') {
    return `📖 **Available commands:**\n\n\`/update\` — Get a project status summary\n\`/analyze\` — Re-analyze attached documents\n\`/help\` — Show this message\n\nYou can also just **attach a file** and I'll analyze it automatically!`;
  }

  return `❓ Unknown command: \`${command}\`\n\nTry \`/help\` to see available commands.`;
}

export const createChatSlice: AppStoreSlice<ChatSlice> = (set, get) => ({
  chatRooms: MOCK_CHATS,
  activeChatId: null,
  isAiStreaming: false,

  setActiveChat: (chatId) => set({ activeChatId: chatId }),

  createChat: (title) => {
    const { currentUser, chatRooms } = get();
    const newChat = {
      id: `chat-${Date.now()}`,
      title,
      participants: currentUser ? [currentUser] : [],
      messages: [],
      createdAt: new Date(),
      lastMessageAt: new Date(),
    };

    set({ chatRooms: [newChat, ...chatRooms], activeChatId: newChat.id });
    return newChat;
  },

  joinChat: (chatId) => {
    const { currentUser, chatRooms } = get();
    if (!currentUser) return { success: false, error: 'You must be logged in to join a chat' };

    const room = chatRooms.find(r => r.id === chatId);
    if (!room) return { success: false, error: 'Chat not found. Check the link and try again.' };

    const alreadyIn = room.participants.some(p => p.id === currentUser.id);
    if (!alreadyIn) {
      set({
        chatRooms: chatRooms.map(r =>
          r.id === chatId
            ? { ...r, participants: [...r.participants, currentUser] }
            : r
        ),
      });
    }

    set({ activeChatId: chatId });
    return { success: true };
  },

  sendMessage: async (chatId, content, attachments) => {
    const { currentUser, chatRooms } = get();
    if (!currentUser) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      chatId,
      authorId: currentUser.id,
      role: currentUser.role,
      content,
      attachments,
      timestamp: new Date(),
    };

    set({
      chatRooms: chatRooms.map(r =>
        r.id === chatId
          ? { ...r, messages: [...r.messages, newMsg], lastMessageAt: new Date() }
          : r
      ),
    });

    if (attachments && attachments.length > 0) {
      await get().runCommand(chatId, '/analyze');
    }
  },

  runCommand: async (chatId, command) => {
    set({ isAiStreaming: true });
    await new Promise(r => setTimeout(r, 1500));

    const systemMsg: Message = {
      id: `ai-${Date.now()}`,
      chatId,
      authorId: 'ai',
      role: 'ai',
      content: getAiCommandResponse(command),
      timestamp: new Date(),
    };

    set({
      chatRooms: get().chatRooms.map(r =>
        r.id === chatId
          ? {
              ...r,
              aiAnalysis: command.trim().toLowerCase().startsWith('/analyze')
                ? MOCK_AI_ANALYSIS
                : r.aiAnalysis,
              messages: [...r.messages, systemMsg],
              lastMessageAt: new Date(),
            }
          : r
      ),
      isAiStreaming: false,
    });
  },
});
