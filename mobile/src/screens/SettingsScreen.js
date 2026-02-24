import React, { useEffect, useState } from 'react';
import { Button, Input, Paragraph } from 'tamagui';
import { ScreenShell } from '../components/ScreenShell';
import { useAppStore } from '../store/useAppStore';
import { apiGet } from '../api/client';

export function SettingsScreen() {
  const { baseUrl, projectId, token, refreshSeconds, setConnection, setRefreshSeconds } = useAppStore();
  const [draft, setDraft] = useState({ baseUrl, projectId, token, refreshSeconds: String(refreshSeconds) });
  const [health, setHealth] = useState('');

  useEffect(() => {
    setDraft({ baseUrl, projectId, token, refreshSeconds: String(refreshSeconds) });
  }, [baseUrl, projectId, token, refreshSeconds]);

  const save = () => {
    setConnection({ baseUrl: draft.baseUrl, projectId: draft.projectId, token: draft.token });
    setRefreshSeconds(Math.max(3, Number(draft.refreshSeconds || 8)));
  };

  const check = async () => {
    try {
      const h = await apiGet('/health');
      setHealth(JSON.stringify(h));
    } catch (e) {
      setHealth('连接失败');
    }
  };

  return (
    <ScreenShell title="Settings" subtitle="连接与运行参数" loading={false}>
      <Input value={draft.baseUrl} onChangeText={(v) => setDraft((s) => ({ ...s, baseUrl: v }))} placeholder="API Base URL" />
      <Input value={draft.projectId} onChangeText={(v) => setDraft((s) => ({ ...s, projectId: v }))} placeholder="Project ID" />
      <Input value={draft.token} onChangeText={(v) => setDraft((s) => ({ ...s, token: v }))} placeholder="Bearer Token" />
      <Input value={draft.refreshSeconds} onChangeText={(v) => setDraft((s) => ({ ...s, refreshSeconds: v }))} placeholder="Refresh Seconds" keyboardType="numeric" />
      <Button onPress={save}>Save</Button>
      <Button theme="active" onPress={check}>Health Check</Button>
      {!!health && <Paragraph color="$gray10">{health}</Paragraph>}
    </ScreenShell>
  );
}
