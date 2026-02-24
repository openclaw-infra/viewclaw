import React, { useState } from 'react';
import { Button, H3, Paragraph, ScrollView, Separator, XStack, YStack } from 'tamagui';
import { apiGet, apiPost } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';

export function BoardScreen() {
  const [tasks, setTasks] = useState([]);
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    const data = await apiGet('/api/tasks');
    setTasks(Array.isArray(data) ? data : []);
  };

  usePolling(load, [], refreshSeconds * 1000);

  const groups = {
    queued: tasks.filter((x) => x.status === 'queued'),
    'in-progress': tasks.filter((x) => x.status === 'in-progress'),
    done: tasks.filter((x) => x.status === 'done'),
    failed: tasks.filter((x) => x.status === 'failed'),
  };

  return (
    <YStack f={1} p="$3" gap="$3">
      <XStack jc="space-between" ai="center">
        <H3 color="white">Board</H3>
        <Button size="$2" onPress={() => apiPost('/api/worker/tick').then(load)}>Run Tick</Button>
      </XStack>

      <ScrollView>
        {Object.entries(groups).map(([key, list]) => (
          <YStack key={key} bg="$secondary" br="$3" p="$3" mb="$3" gap="$2">
            <Paragraph color="white" fontWeight="700">{key.toUpperCase()} ({list.length})</Paragraph>
            <Separator />
            {list.length === 0 ? (
              <Paragraph color="$gray10">No tasks</Paragraph>
            ) : (
              list.map((task) => (
                <YStack key={task.id} bg="$background" br="$2" p="$2" gap="$1">
                  <Paragraph color="white" fontWeight="700">{task.title}</Paragraph>
                  <Paragraph color="$gray10">{task.priority} · retry {task.retryCount}/{task.maxRetries}</Paragraph>
                  {!!task.error && <Paragraph color="$red10">{task.error}</Paragraph>}
                  {!!task.result && <Paragraph color="$green10">{task.result}</Paragraph>}
                </YStack>
              ))
            )}
          </YStack>
        ))}
      </ScrollView>
    </YStack>
  );
}
