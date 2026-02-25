import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set) => ({
      baseUrl: 'http://127.0.0.1:8787',
      projectId: 'default',
      token: '',
      refreshSeconds: 8,
      themeMode: 'dark',
      toast: { visible: false, text: '', type: 'info' },
      setConnection: ({ baseUrl, projectId, token }) =>
        set((state) => ({
          baseUrl: (baseUrl ?? state.baseUrl).replace(/\/+$/, ''),
          projectId: projectId ?? state.projectId,
          token: token ?? state.token,
        })),
      setRefreshSeconds: (refreshSeconds) => set({ refreshSeconds }),
      setThemeMode: (themeMode) => set({ themeMode }),
      toggleThemeMode: () =>
        set((state) => ({ themeMode: state.themeMode === 'dark' ? 'light' : 'dark' })),
      showToast: (text, type = 'info') => set({ toast: { visible: true, text, type } }),
      hideToast: () => set({ toast: { visible: false, text: '', type: 'info' } }),
    }),
    {
      name: 'viewclaw-mobile-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
