import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'viewclaw-mobile-store';

const listeners = new Set();

let state = {
  baseUrl: 'http://127.0.0.1:8787',
  projectId: 'default',
  token: '',
  refreshSeconds: 8,
};

const emit = () => {
  listeners.forEach((listener) => listener());
};

const save = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore persistence errors in runtime
  }
};

const setState = (updater) => {
  const next = typeof updater === 'function' ? updater(state) : updater;
  state = { ...state, ...next };
  emit();
  void save();
};

const hydrate = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      state = { ...state, ...parsed };
      emit();
    }
  } catch {
    // ignore hydration errors in runtime
  }
};

void hydrate();

const actions = {
  setConnection: ({ baseUrl, projectId, token }) =>
    setState((prev) => ({
      baseUrl: (baseUrl ?? prev.baseUrl).replace(/\/+$/, ''),
      projectId: projectId ?? prev.projectId,
      token: token ?? prev.token,
    })),
  setRefreshSeconds: (refreshSeconds) => setState({ refreshSeconds }),
};

const snapshot = () => ({ ...state, ...actions });

export function useAppStore(selector = (s) => s) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selector(snapshot()),
    () => selector(snapshot())
  );
}

useAppStore.getState = () => snapshot();
