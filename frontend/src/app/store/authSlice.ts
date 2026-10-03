import { loginRequest, registerRequest } from '../../shared/api';
import { clearAccessToken, getAccessToken, setAccessToken } from '../../shared/api';
import { decodeUserFromToken } from '../../shared/api';
import { getErrorMessage } from '../../shared/api';
import type { AppStoreSlice, AuthSlice } from './types';

export const createAuthSlice: AppStoreSlice<AuthSlice> = (set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  accessToken: null,

  hydrateAuth: () => {
    const token = getAccessToken();
    if (!token) {
      set({
        currentUser: null,
        isAuthenticated: false,
        accessToken: null,
        chatRooms: [],
        activeChatId: null,
      });
      return;
    }
    const user = decodeUserFromToken(token);
    if (!user) return;

    set({
      currentUser: user,
      isAuthenticated: true,
      accessToken: token,
    });
    void get().loadChats();
  },

  login: async (email, password) => {
    try {
      const response = await loginRequest({ email, password });
      const user = decodeUserFromToken(response.access_token);
      if (!user) {
        return { success: false, error: 'Could not read user session from token' };
      }

      setAccessToken(response.access_token);
      set({
        currentUser: user,
        isAuthenticated: true,
        accessToken: response.access_token,
      });
      void get().loadChats();
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  register: async (name, email, password, role) => {
    try {
      await registerRequest({ name, email, password, role });
      const loginResult = await get().login(email, password);
      if (!loginResult.success) return loginResult;
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  logout: () => {
    clearAccessToken();
    set({
      currentUser: null,
      isAuthenticated: false,
      accessToken: null,
      activeChatId: null,
      chatRooms: [],
    });
  },
});
