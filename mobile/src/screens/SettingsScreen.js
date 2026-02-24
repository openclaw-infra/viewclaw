import React, { useEffect, useState } from 'react';
import { Button, Input, Text, YStack } from 'tamagui';
import { ScreenShell } from '../components/ScreenShell';
import { useAppStore } from '../store/useAppStore';
import { apiGet } from '../api/client';
import { toErrorText } from '../utils/errorText';

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
    setHealth('Saved.');
  };

  const check = async () => {
    try {
      const h = await apiGet('/health');
      setHealth(JSON.stringify(h));
    } catch (e) {
      setHealth(toErrorText(e, 'Connection failed'));
    }
  };

  return (
    <ScreenShell title="Settings" subtitle="Connection & Runtime" loading={false}>
      <YStack gap="$3" bg="$card" p="$4" br="$4" borderWidth={1} borderColor="$border">
        <Input value={draft.baseUrl} onChangeText={(v) => setDraft((s) => ({ ...s, baseUrl: v }))} placeholder="API Base URL" bg="$background" borderColor="$border" color="$text" />
        <Input value={draft.projectId} onChangeText={(v) => setDraft((s) => ({ ...s, projectId: v }))} placeholder="Project ID" bg="$background" borderColor="$border" color="$text" />
        <Input value={draft.token} onChangeText={(v) => setDraft((s) => ({ ...s, token: v }))} placeholder="Bearer Token" bg="$background" borderColor="$border" color="$text" />
        <Input value={draft.refreshSeconds} onChangeText={(v) => setDraft((s) => ({ ...s, refreshSeconds: v }))} placeholder="Refresh seconds" keyboardType="numeric" bg="$background" borderColor="$border" color="$text" />
        <Button onPress={save} bg="$primary" color="white">Save</Button>
        <Button onPress={check} bg="$primaryBg" color="$primaryText">Health Check</Button>
        {!!health && <Text color="$textMuted">{health}</Text>}
      </YStack>
    </ScreenShell>
  );
}
