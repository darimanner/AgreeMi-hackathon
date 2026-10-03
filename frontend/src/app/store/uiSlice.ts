import type { AppStoreSlice, UiSlice } from './types';

export const createUiSlice: AppStoreSlice<UiSlice> = (set) => ({
  isSidebarOpen: true,
  theme: 'dark',
  toggleSidebar: () => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setTheme: (theme) => set({ theme }),
});
