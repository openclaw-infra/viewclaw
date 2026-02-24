import React, { useState } from 'react';
import { Button, H3, Input, Paragraph, ScrollView, XStack, YStack } from 'tamagui';
import { apiGet, apiPost } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';

export function RunsScreen() {
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState('');
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    const data = await apiGet('/api/runs');
    setRuns(Array.isArray(data) ? data : []);
  };
  usePolling(load, [], refreshSeconds * 1000);

  return (
    <YStack f={1} p="$3" gap="$3">
      <H3 color="white">Runs</H3>
      <XStack gap="$2">
        <Input f={1} value={runId} onChangeText={setRunId} placeholder="Run ID to finalize" />
        <Button onPress={() => apiPost(`/api/runs/${runId}/finalize`, { status: 'done', result: 'manual finalize from mobile' }).then(load)}>Done</Button>
      </XStack>
      <ScrollView>
        {runs.map((run) => (
          <YStack key={run.id} bg="$secondary" br="$3" p="$3" mb="$2" gap="$1">
            <Paragraph color="white" fontWeight="700">{run.id.slice(0, 8)} · {run.status}</Paragraph>
            <Paragraph color="$gray10">task: {run.taskId}</Paragraph>
            <Paragraph color="$gray10">executor: {run.executor}</Paragraph>
            {!!run.externalSessionKey && <Paragraph color="$blue10">session: {run.externalSessionKey}</Paragraph>}
          </YStack>
        ))}
      </ScrollView>
    </YStack>
  );
}
