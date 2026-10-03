import type { StateCreator } from 'zustand';
import type { Attachment, ChatRoom, User } from '../../shared/types';

export type AuthResult = { success: boolean; error?: string };
export type JoinResult = AuthResult & { chatId?: string };
export type ThemeMode = 'dark' | 'light';

export interface AuthSlice {
  currentUser: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, password: string, role: User['role']) => Promise<AuthResult>;
  hydrateAuth: () => void;
  logout: () => void;
}

export interface ChatSlice {
  chatRooms: ChatRoom[];
  activeChatId: string | null;
  streamingChatId: string | null;
  isAiStreaming: boolean;
  setActiveChat: (chatId: string) => void;
  leaveChat: (chatId: string) => void;
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  createChat: (title: string) => Promise<ChatRoom>;
  joinChat: (chatId: string) => Promise<JoinResult>;
  sendMessage: (chatId: string, content: string, attachments?: Attachment[]) => Promise<void>;
  runCommand: (chatId: string, command: string) => Promise<void>;
  receiveMessage: (chatId: string, message: ChatRoom['messages'][number]) => void;
}

export interface UiSlice {
  isSidebarOpen: boolean;
  theme: ThemeMode;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

export type AppStore = AuthSlice & ChatSlice & UiSlice;

export type AppStoreSlice<T> = StateCreator<AppStore, [], [], T>;
