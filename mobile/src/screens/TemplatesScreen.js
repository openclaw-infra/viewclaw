import React, { useState } from 'react';
import { Button, Input, Text, ScrollView, TextArea, XStack, YStack } from 'tamagui';
import { ScreenShell } from '../components/ScreenShell';
import { ToastBanner } from '../components/ToastBanner';
import { EmptyState } from '../components/EmptyState';
import { apiGet, apiPost } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';
import { toErrorText } from '../utils/errorText';

export function TemplatesScreen() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    try {
      const data = await apiGet('/api/templates');
      setItems(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(toErrorText(e, 'Failed to load templates'));
    } finally {
      setLoading(false);
    }
  };
  usePolling(load, [refreshSeconds], refreshSeconds * 1000);

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 2600);
  };

  const create = async () => {
    if (!name.trim() || !prompt.trim()) return;
    try {
      await apiPost('/api/templates', { name, prompt, priority: 'medium' });
      setName('');
      setPrompt('');
      showToast('Template created');
      load();
    } catch (e) {
      showToast(toErrorText(e, 'Create template failed'), 'error');
    }
  };

  const createTask = async (templateId) => {
    try {
      await apiPost('/api/tasks', { templateId, title: '' });
      showToast('Task created from template');
    } catch (e) {
      showToast(toErrorText(e, 'Create task failed'), 'error');
    }
  };

  return (
    <ScreenShell title="Templates" subtitle="Template Management" loading={loading} error={error}>
      {toast && <ToastBanner text={toast.text} type={toast.type} />}

      <YStack bg="$card" p="$4" br="$4" gap="$3" mb="$3" borderWidth={1} borderColor="$border">
        <Input placeholder="Template name" value={name} onChangeText={setName} bg="$background" borderColor="$border" color="$text" />
        <TextArea placeholder="Prompt" value={prompt} onChangeText={setPrompt} bg="$background" borderColor="$border" color="$text" />
        <Button bg="$primary" color="white" onPress={create}>Create Template</Button>
      </YStack>

      <ScrollView showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <EmptyState title="No Templates" subtitle="Create one to quickly generate tasks" />
        ) : (
          items.map((tpl) => (
            <YStack key={tpl.id} bg="$card" br="$4" p="$4" mb="$3" gap="$2" borderWidth={1} borderColor="$border">
              <Text color="$text" fontWeight="700" fontSize="$5">{tpl.name}</Text>
              <Text color="$textMuted" numberOfLines={3}>{tpl.prompt}</Text>
              <XStack>
                <Button size="$3" onPress={() => createTask(tpl.id)} bg="$primaryBg" color="$primaryText">Create Task</Button>
              </XStack>
            </YStack>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}
