import type { User } from '../../shared/types';
import type { AppStoreSlice, AuthSlice } from './types';

export const createAuthSlice: AppStoreSlice<AuthSlice> = (set) => ({
  currentUser: null,
  isAuthenticated: false,

  login: async (email, password) => {
    await new Promise(r => setTimeout(r, 800));
    // Mock auth: accept any known email or allow demo login.
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
    set({
      currentUser: {
        id: `user-${Date.now()}`,
        name,
        email,
        role,
      },
      isAuthenticated: true,
    });
    return { success: true };
  },

  logout: () => {
    set({ currentUser: null, isAuthenticated: false, activeChatId: null });
  },
});
