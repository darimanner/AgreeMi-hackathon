import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, ChatRoom, Message, AiAnalysis, Attachment } from '../shared/types';

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_DEV: User = {
  id: 'dev-1',
  name: 'Alex Dev',
  email: 'alex@devteam.io',
  role: 'developer',
};

const MOCK_CLIENT: User = {
  id: 'client-1',
  name: 'Sarah Client',
  email: 'sarah@company.com',
  role: 'client',
};

const MOCK_AI_ANALYSIS: AiAnalysis = {
  summary: 'The uploaded specification has several ambiguous requirements that may cause misunderstandings. Overall quality is moderate.',
  score: 62,
  issues: [
    {
      id: 'a1',
      severity: 'critical',
      title: 'No deadline specified',
      description: 'The project timeline is completely absent from the specification document.',
      suggestion: 'Add explicit milestone dates and a delivery deadline.',
    },
    {
      id: 'a2',
      severity: 'warning',
      title: 'Vague performance requirements',
      description: '"The app should be fast" is not a measurable requirement.',
      suggestion: 'Define SLA: e.g. "API response time ≤ 200ms at p95".',
    },
    {
      id: 'a3',
      severity: 'info',
      title: 'Missing error handling spec',
      description: 'There is no mention of how the system should handle failures.',
      suggestion: 'Document error codes, user-facing messages, and retry policies.',
    },
  ],
  generatedAt: new Date(Date.now() - 3600000),
};

const MOCK_CHATS: ChatRoom[] = [
  {
    id: 'chat-1',
    title: 'E-Commerce Platform MVP',
    participants: [MOCK_CLIENT, MOCK_DEV],
    createdAt: new Date(Date.now() - 86400000 * 2),
    lastMessageAt: new Date(Date.now() - 1800000),
    aiAnalysis: MOCK_AI_ANALYSIS,
    messages: [
      {
        id: 'm1',
        chatId: 'chat-1',
        authorId: 'client-1',
        role: 'client',
        content: 'Hi! I\'ve uploaded our project spec. Can you review it?',
        timestamp: new Date(Date.now() - 86400000),
      },
      {
        id: 'm2',
        chatId: 'chat-1',
        authorId: 'dev-1',
        role: 'developer',
        content: 'Sure! I\'ll check it right now. Give me a few minutes.',
        timestamp: new Date(Date.now() - 86400000 + 60000),
      },
      {
        id: 'm3',
        chatId: 'chat-1',
        authorId: 'ai',
        role: 'ai',
        content: '🤖 **AI Analysis complete.** I found 3 issues in the specification. Check the sidebar for details.',
        timestamp: new Date(Date.now() - 86400000 + 120000),
      },
      {
        id: 'm4',
        chatId: 'chat-1',
        authorId: 'dev-1',
        role: 'developer',
        content: 'The AI flagged some performance requirements as too vague. Let\'s discuss what SLAs you need.',
        timestamp: new Date(Date.now() - 1800000),
      },
    ],
  },
  {
    id: 'chat-2',
    title: 'Mobile App Redesign',
    participants: [MOCK_CLIENT, MOCK_DEV],
    createdAt: new Date(Date.now() - 86400000 * 5),
    lastMessageAt: new Date(Date.now() - 7200000),
    messages: [
      {
        id: 'm5',
        chatId: 'chat-2',
        authorId: 'client-1',
        role: 'client',
        content: 'Let\'s kick off the redesign project here.',
        timestamp: new Date(Date.now() - 7200000),
      },
    ],
  },
];

// ── Store interface ────────────────────────────────────────────────────────────

interface AppStore {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;

  // Chat rooms
  chatRooms: ChatRoom[];
  activeChatId: string | null;

  // AI sidebar
  isSidebarOpen: boolean;
  isAiStreaming: boolean;

  // Actions: Auth
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, role: User['role']) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  // Actions: Chats
  setActiveChat: (chatId: string) => void;
  createChat: (title: string) => ChatRoom;
  joinChat: (chatId: string) => { success: boolean; error?: string };
  sendMessage: (chatId: string, content: string, attachments?: Attachment[]) => Promise<void>;
  runCommand: (chatId: string, command: string) => Promise<void>;

  // Actions: Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentUser: null,
      isAuthenticated: false,
      chatRooms: MOCK_CHATS,
      activeChatId: null,
      isSidebarOpen: true,
      isAiStreaming: false,

      // ── Auth ──────────────────────────────────────────────

      login: async (email, password) => {
        await new Promise(r => setTimeout(r, 800));
        // Mock auth — accept any known email or allow demo login
        if (password.length < 3) {
          return { success: false, error: 'Password too short' };
        }
        const isClient = email.includes('client') || !email.includes('dev');
        const user: User = {
          id: isClient ? 'client-1' : 'dev-1',
          name: isClient ? 'Sarah Client' : 'Alex Dev',
          email,
          role: isClient ? 'client' : 'developer',
        };
        set({ currentUser: user, isAuthenticated: true });
        return { success: true };
      },

      register: async (name, email, _password, role) => {
        await new Promise(r => setTimeout(r, 1000));
        const user: User = {
          id: `user-${Date.now()}`,
          name,
          email,
          role,
        };
        set({ currentUser: user, isAuthenticated: true });
        return { success: true };
      },

      logout: () => {
        set({ currentUser: null, isAuthenticated: false, activeChatId: null });
      },

      // ── Chats ─────────────────────────────────────────────

      setActiveChat: (chatId) => set({ activeChatId: chatId }),

      createChat: (title) => {
        const { currentUser, chatRooms } = get();
        const newChat: ChatRoom = {
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

        // If there are attachments, trigger AI analysis
        if (attachments && attachments.length > 0) {
          await get().runCommand(chatId, '/analyze');
        }
      },

      runCommand: async (chatId, command) => {
        set({ isAiStreaming: true });

        await new Promise(r => setTimeout(r, 1500));

        const cmd = command.trim().toLowerCase();
        let aiResponse: string;

        if (cmd === '/update' || cmd.startsWith('/update')) {
          aiResponse = `🔄 **Project Status Update**\n\nBased on the conversation history:\n\n- **Completed:** Initial spec review, performance requirements discussion\n- **In Progress:** Clarifying timeline and SLA definitions\n- **Blocked:** Awaiting client sign-off on updated requirements\n\n📊 **Current spec quality score:** 62/100\n\n_Use \`/update\` anytime to get a fresh summary._`;
        } else if (cmd === '/analyze') {
          aiResponse = `🤖 **File analyzed!** I've reviewed the attachment and updated the sidebar with my findings.\n\nKey observations:\n- **3 issues found** (1 critical, 1 warning, 1 info)\n- Overall quality score: **62/100**\n\nClick the sidebar panel ↗ for details.`;
        } else if (cmd === '/help') {
          aiResponse = `📖 **Available commands:**\n\n\`/update\` — Get a project status summary\n\`/analyze\` — Re-analyze attached documents\n\`/help\` — Show this message\n\nYou can also just **attach a file** and I'll analyze it automatically!`;
        } else {
          aiResponse = `❓ Unknown command: \`${command}\`\n\nTry \`/help\` to see available commands.`;
        }

        const systemMsg: Message = {
          id: `ai-${Date.now()}`,
          chatId,
          authorId: 'ai',
          role: 'ai',
          content: aiResponse,
          timestamp: new Date(),
        };

        const currentRooms = get().chatRooms;
        set({
          chatRooms: currentRooms.map(r =>
            r.id === chatId
              ? { ...r, messages: [...r.messages, systemMsg], lastMessageAt: new Date() }
              : r
          ),
          isAiStreaming: false,
        });
      },

      // ── Sidebar ───────────────────────────────────────────

      toggleSidebar: () => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
    }),
    {
      name: 'reqlens-v2-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
        chatRooms: state.chatRooms,
        activeChatId: state.activeChatId,
        isSidebarOpen: state.isSidebarOpen,
      }),
    }
  )
);
