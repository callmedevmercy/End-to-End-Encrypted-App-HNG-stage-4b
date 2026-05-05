import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: sessionStorage.getItem('access_token') || null,
  refreshToken: sessionStorage.getItem('refresh_token') || null,
  privateKey: null, // CryptoKey in memory only — never persisted
  isAuthenticated: false,
  isInitializing: true,

  setAuth: (user, accessToken, refreshToken) => {
    sessionStorage.setItem('access_token', accessToken);
    if (refreshToken) {
      sessionStorage.setItem('refresh_token', refreshToken);
    }
    set({
      user,
      accessToken,
      refreshToken: refreshToken || get().refreshToken,
      isAuthenticated: true,
    });
  },

  setPrivateKey: (key) => set({ privateKey: key }),

  updateAccessToken: (newToken) => {
    sessionStorage.setItem('access_token', newToken);
    set({ accessToken: newToken });
  },

  logout: () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      privateKey: null,
      isAuthenticated: false,
    });
  },

  setInitializing: (status) => set({ isInitializing: status }),
}));
