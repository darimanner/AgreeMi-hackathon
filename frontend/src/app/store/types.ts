import type { StateCreator } from 'zustand';
import type { Attachment, ChatRoom, User } from '../../shared/types';

export type AuthResult = { success: boolean; error?: string };

export interface AuthSlice {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, password: string, role: User['role']) => Promise<AuthResult>;
  logout: () => void;
}

export interface ChatSlice {
  chatRooms: ChatRoom[];
  activeChatId: string | null;
  isAiStreaming: boolean;
  setActiveChat: (chatId: string) => void;
  createChat: (title: string) => ChatRoom;
  joinChat: (chatId: string) => AuthResult;
  sendMessage: (chatId: string, content: string, attachments?: Attachment[]) => Promise<void>;
  runCommand: (chatId: string, command: string) => Promise<void>;
}

export interface UiSlice {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export type AppStore = AuthSlice & ChatSlice & UiSlice;

export type AppStoreSlice<T> = StateCreator<AppStore, [], [], T>;
