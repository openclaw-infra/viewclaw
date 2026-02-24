import { useAppStore } from '../store/useAppStore';

function headers() {
  const { projectId, token } = useAppStore.getState();
  return {
    'Content-Type': 'application/json',
    'x-project-id': projectId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function base() {
  const { baseUrl } = useAppStore.getState();
  return baseUrl.replace(/\/+$/, '');
}

export async function apiGet(path) {
  const res = await fetch(`${base()}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path, body = {}) {
  const res = await fetch(`${base()}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
