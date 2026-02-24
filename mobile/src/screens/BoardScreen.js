import React, { useState } from 'react';
import { Button, Paragraph, ScrollView, Separator, XStack, YStack } from 'tamagui';
import { ScreenShell } from '../components/ScreenShell';
import { StatusPill } from '../components/StatusPill';
import { ToastBanner } from '../components/ToastBanner';
import { EmptyState } from '../components/EmptyState';
import { apiGet, apiPost } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';

export function BoardScreen() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    try {
      const data = await apiGet('/api/tasks');
      setTasks(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError('加载任务失败，请检查服务端连接');
    } finally {
      setLoading(false);
    }
  };

  usePolling(load, [], refreshSeconds * 1000);

  const groups = {
    queued: tasks.filter((x) => x.status === 'queued'),
    'in-progress': tasks.filter((x) => x.status === 'in-progress'),
    done: tasks.filter((x) => x.status === 'done'),
    failed: tasks.filter((x) => x.status === 'failed'),
  };

  return (
    <ScreenShell
      title="Board"
      subtitle="任务看板（V1/V2）"
      loading={loading}
      error={error}
      right={<Button size="$2" onPress={() => apiPost('/api/worker/tick').then(() => { setToast('调度已触发'); load(); }).catch(() => setToast('调度失败'))}>Run Tick</Button>}
    >
      <ToastBanner text={toast} type={toast.includes('失败') ? 'error' : 'success'} />
      <ScrollView>
        {tasks.length === 0 ? (
          <EmptyState title="暂无任务" subtitle="先去 Templates 创建模板，再一键生成任务" />
        ) : Object.entries(groups).map(([key, list]) => (
          <YStack key={key} bg="$secondary" br="$3" p="$3" mb="$3" gap="$2">
            <Paragraph color="white" fontWeight="700">{key.toUpperCase()} ({list.length})</Paragraph>
            <Separator />
            {list.length === 0 ? (
              <Paragraph color="$gray10">No tasks</Paragraph>
            ) : (
              list.map((task) => (
                <YStack key={task.id} bg="$background" br="$2" p="$2" gap="$1">
                  <Paragraph color="white" fontWeight="700">{task.title}</Paragraph>
                  <XStack gap="$2" ai="center">
                    <StatusPill value={task.status} />
                    <Paragraph color="$gray10">{task.priority} · retry {task.retryCount}/{task.maxRetries}</Paragraph>
                  </XStack>
                  {!!task.error && <Paragraph color="$red10">{task.error}</Paragraph>}
                  {!!task.result && <Paragraph color="$green10">{task.result}</Paragraph>}
                </YStack>
              ))
            )}
          </YStack>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}
