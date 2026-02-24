import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Paragraph, ScrollView, Separator, XStack, YStack } from 'tamagui';
import { ScreenShell } from '../components/ScreenShell';
import { StatusPill } from '../components/StatusPill';
import { ToastBanner } from '../components/ToastBanner';
import { EmptyState } from '../components/EmptyState';
import { apiGet, apiPost } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';
import { toErrorText } from '../utils/errorText';

export function BoardScreen() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    try {
      const data = await apiGet('/api/tasks');
      setTasks(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(toErrorText(e, '加载任务失败，请检查服务端连接'));
    } finally {
      setLoading(false);
    }
  };

  usePolling(load, [refreshSeconds], refreshSeconds * 1000);

  const groups = {
    queued: tasks.filter((x) => x.status === 'queued'),
    'in-progress': tasks.filter((x) => x.status === 'in-progress'),
    done: tasks.filter((x) => x.status === 'done'),
    failed: tasks.filter((x) => x.status === 'failed'),
  };

  const act = async (task, type) => {
    try {
      if (type === 'pickup') await apiPost(`/api/tasks/${task.id}/pickup`);
      if (type === 'complete') await apiPost(`/api/tasks/${task.id}/complete`, { result: 'complete from mobile' });
      if (type === 'fail') await apiPost(`/api/tasks/${task.id}/fail`, { error: 'failed from mobile confirm action' });
      setToast(`任务 ${type} 成功`);
      await load();
    } catch {
      setToast(`任务 ${type} 失败`);
    }
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
                  <XStack jc="space-between" ai="center">
                    <Paragraph color="white" fontWeight="700">{task.title}</Paragraph>
                    <Button size="$1" onPress={() => setSelectedTask(task)}>详情</Button>
                  </XStack>
                  <XStack gap="$2" ai="center">
                    <StatusPill value={task.status} />
                    <Paragraph color="$gray10">{task.priority} · retry {task.retryCount}/{task.maxRetries}</Paragraph>
                  </XStack>
                  {!!task.error && <Paragraph color="$red10">{task.error}</Paragraph>}
                  {!!task.result && <Paragraph color="$green10">{task.result}</Paragraph>}
                  <XStack gap="$2" mt="$1">
                    {task.status !== 'in-progress' && task.status !== 'done' && (
                      <Button size="$1" onPress={() => act(task, 'pickup')}>Pickup</Button>
                    )}
                    {task.status !== 'done' && (
                      <Button
                        size="$1"
                        onPress={() => Alert.alert('确认完成', `确定将任务「${task.title}」标记为完成吗？`, [
                          { text: '取消', style: 'cancel' },
                          { text: '确定', onPress: () => act(task, 'complete') },
                        ])}
                      >
                        Complete
                      </Button>
                    )}
                    {task.status !== 'failed' && task.status !== 'done' && (
                      <Button
                        size="$1"
                        theme="red"
                        onPress={() => Alert.alert('确认失败', `确定将任务「${task.title}」标记为失败吗？`, [
                          { text: '取消', style: 'cancel' },
                          { text: '确定', style: 'destructive', onPress: () => act(task, 'fail') },
                        ])}
                      >
                        Fail
                      </Button>
                    )}
                  </XStack>
                </YStack>
              ))
            )}
          </YStack>
        ))}
      </ScrollView>

      {!!selectedTask && (
        <YStack bg="$secondary" br="$3" p="$3" mt="$2" gap="$1">
          <XStack jc="space-between" ai="center">
            <Paragraph color="white" fontWeight="700">Task Detail</Paragraph>
            <Button size="$1" onPress={() => setSelectedTask(null)}>关闭</Button>
          </XStack>
          <Paragraph color="$gray10">id: {selectedTask.id}</Paragraph>
          <Paragraph color="$gray10">title: {selectedTask.title}</Paragraph>
          <Paragraph color="$gray10">status: {selectedTask.status}</Paragraph>
          <Paragraph color="$gray10">skill: {selectedTask.skill || '-'}</Paragraph>
          <Paragraph color="$gray10">updatedAt: {selectedTask.updatedAt}</Paragraph>
        </YStack>
      )}
    </ScreenShell>
  );
}
