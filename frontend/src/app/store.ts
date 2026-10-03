import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAuthSlice } from './store/authSlice';
import { createChatSlice } from './store/chatSlice';
import { createUiSlice } from './store/uiSlice';
import type { AppStore } from './store/types';

export const useAppStore = create<AppStore>()(
  persist(
    (...args) => ({
      ...createAuthSlice(...args),
      ...createChatSlice(...args),
      ...createUiSlice(...args),
    }),
    {
      name: 'reqlens-v2-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
        chatRooms: state.chatRooms,
        activeChatId: state.activeChatId,
        isSidebarOpen: state.isSidebarOpen,
        theme: state.theme,
      }),
    }
  )
);

useAppStore.getState().hydrateAuth();
