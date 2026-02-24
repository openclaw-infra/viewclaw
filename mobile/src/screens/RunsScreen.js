import React, { useState } from 'react';
import { Button, Input, Paragraph, ScrollView, XStack, YStack } from 'tamagui';
import { ScreenShell } from '../components/ScreenShell';
import { StatusPill } from '../components/StatusPill';
import { apiGet, apiPost } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';

export function RunsScreen() {
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    try {
      const data = await apiGet('/api/runs');
      setRuns(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError('加载 runs 失败');
    } finally {
      setLoading(false);
    }
  };
  usePolling(load, [], refreshSeconds * 1000);

  return (
    <ScreenShell title="Runs" subtitle="执行记录（V2/V3）" loading={loading} error={error}>
      <XStack gap="$2">
        <Input f={1} value={runId} onChangeText={setRunId} placeholder="Run ID to finalize" />
        <Button onPress={() => apiPost(`/api/runs/${runId}/finalize`, { status: 'done', result: 'manual finalize from mobile' }).then(load)}>Done</Button>
      </XStack>
      <ScrollView>
        {runs.map((run) => (
          <YStack key={run.id} bg="$secondary" br="$3" p="$3" mb="$2" gap="$1">
            <XStack ai="center" gap="$2">
              <Paragraph color="white" fontWeight="700">{run.id.slice(0, 8)}</Paragraph>
              <StatusPill value={run.status} />
            </XStack>
            <Paragraph color="$gray10">task: {run.taskId}</Paragraph>
            <Paragraph color="$gray10">executor: {run.executor}</Paragraph>
            {!!run.externalSessionKey && <Paragraph color="$blue10">session: {run.externalSessionKey}</Paragraph>}
          </YStack>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}
