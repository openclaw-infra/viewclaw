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
      setConnection: ({ baseUrl, projectId, token }) =>
        set((state) => ({
          baseUrl: (baseUrl ?? state.baseUrl).replace(/\/+$/, ''),
          projectId: projectId ?? state.projectId,
          token: token ?? state.token,
        })),
      setRefreshSeconds: (refreshSeconds) => set({ refreshSeconds }),
    }),
    {
      name: 'viewclaw-mobile-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
