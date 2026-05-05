import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: sessionStorage.getItem('access_token') || null,
  privateKey: null, // CryptoKey in memory only
  isAuthenticated: false,
  isInitializing: true,

  setAuth: (user, token) => {
    sessionStorage.setItem('access_token', token);
    set({ user, accessToken: token, isAuthenticated: true });
  },

  setPrivateKey: (key) => set({ privateKey: key }),

  logout: () => {
    sessionStorage.removeItem('access_token');
    set({ user: null, accessToken: null, privateKey: null, isAuthenticated: false });
  },
  
  setInitializing: (status) => set({ isInitializing: status }),
}));
