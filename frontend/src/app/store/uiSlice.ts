import type { AppStoreSlice, UiSlice } from './types';

export const createUiSlice: AppStoreSlice<UiSlice> = (set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
});
