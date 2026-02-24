import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Button, ScrollView, YStack, Text, XStack } from 'tamagui';
import { RefreshCw, X } from 'lucide-react-native';
import { ScreenShell } from '../components/ScreenShell';
import { TaskCard } from '../components/TaskCard';
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
  const [toast, setToast] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    try {
      const data = await apiGet('/api/tasks');
      setTasks(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(toErrorText(e, 'Failed to load tasks'));
    } finally {
      setLoading(false);
    }
  };

  usePolling(load, [refreshSeconds], refreshSeconds * 1000);

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 2600);
  };

  const act = async (task, type) => {
    try {
      if (type === 'pickup') await apiPost(`/api/tasks/${task.id}/pickup`);
      if (type === 'complete') await apiPost(`/api/tasks/${task.id}/complete`, { result: 'Completed manually via mobile' });
      if (type === 'fail') await apiPost(`/api/tasks/${task.id}/fail`, { error: 'Failed manually via mobile' });
      showToast(`Task ${type} successful`);
      await load();
    } catch (e) {
      showToast(toErrorText(e, `Task ${type} failed`), 'error');
    }
  };

  const onAction = (task, action) => {
    if (action === 'pickup') return act(task, 'pickup');
    Alert.alert(`Confirm ${action}`, `Mark "${task.title}" as ${action}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: action === 'fail' ? 'destructive' : 'default', onPress: () => act(task, action) },
    ]);
  };

  const groups = {
    queued: tasks.filter((x) => x.status === 'queued'),
    'in-progress': tasks.filter((x) => x.status === 'in-progress'),
    done: tasks.filter((x) => x.status === 'done'),
    failed: tasks.filter((x) => x.status === 'failed'),
  };

  return (
    <ScreenShell
      title="Board"
      subtitle={`${tasks.length} tasks`}
      loading={loading}
      error={error}
      right={<Button size="$3" circular icon={RefreshCw} onPress={load} chromeless />}
    >
      {toast && <ToastBanner text={toast.text} type={toast.type} />}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {tasks.length === 0 && !loading ? (
          <EmptyState title="No Tasks Found" subtitle="Create tasks from Templates to get started" />
        ) : (
          <YStack gap="$5">
            {Object.entries(groups).map(([key, list]) =>
              list.length > 0 ? (
                <YStack key={key} gap="$3">
                  <XStack ai="center" gap="$2" px="$1">
                    <Text color="$textMuted" fontSize="$3" fontWeight="800" letterSpacing={1}>{key.toUpperCase()}</Text>
                    <YStack bg="$card" px="$2" py="$1" br="$pill">
                      <Text color="$textMuted" fontSize="$2" fontWeight="700">{list.length}</Text>
                    </YStack>
                  </XStack>
                  <YStack gap="$3">
                    {list.map((task) => (
                      <TaskCard key={task.id} task={task} onAction={onAction} onPress={() => setSelectedTask(task)} />
                    ))}
                  </YStack>
                </YStack>
              ) : null
            )}
          </YStack>
        )}
      </ScrollView>

      {!!selectedTask && (
        <YStack position="absolute" bottom={0} left={0} right={0} bg="$card" borderTopLeftRadius="$5" borderTopRightRadius="$5" p="$5" gap="$3" borderTopWidth={1} borderColor="$border">
          <XStack jc="space-between" ai="center">
            <Text fontSize="$6" fontWeight="700" color="$text">Task Details</Text>
            <Button size="$2" circular icon={X} onPress={() => setSelectedTask(null)} chromeless />
          </XStack>
          <DetailRow label="ID" value={selectedTask.id} />
          <DetailRow label="Title" value={selectedTask.title} />
          <DetailRow label="Status" value={selectedTask.status} />
          <DetailRow label="Skill" value={selectedTask.skill || 'None'} />
          <DetailRow label="Retries" value={`${selectedTask.retryCount}/${selectedTask.maxRetries}`} />
          <DetailRow label="Updated" value={selectedTask.updatedAt} />
        </YStack>
      )}
    </ScreenShell>
  );
}

function DetailRow({ label, value }) {
  return (
    <XStack>
      <Text color="$textMuted" w={90} fontSize="$3">{label}</Text>
      <Text color="$text" f={1} fontSize="$3" numberOfLines={2}>{value}</Text>
    </XStack>
  );
}
