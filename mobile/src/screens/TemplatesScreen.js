import React, { useState } from 'react';
import { Button, Input, Paragraph, ScrollView, TextArea, XStack, YStack } from 'tamagui';
import { ScreenShell } from '../components/ScreenShell';
import { apiGet, apiPost } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';

export function TemplatesScreen() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    try {
      const data = await apiGet('/api/templates');
      setItems(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError('加载模板失败');
    } finally {
      setLoading(false);
    }
  };
  usePolling(load, [], refreshSeconds * 1000);

  const create = async () => {
    if (!name.trim() || !prompt.trim()) return;
    await apiPost('/api/templates', { name, prompt, priority: 'medium' });
    setName('');
    setPrompt('');
    load();
  };

  const createTask = async (templateId) => {
    await apiPost('/api/tasks', { templateId, title: '' });
  };

  return (
    <ScreenShell title="Templates" subtitle="模板管理（V3）" loading={loading} error={error}>
      <Input placeholder="Template Name" value={name} onChangeText={setName} />
      <TextArea placeholder="Prompt" value={prompt} onChangeText={setPrompt} />
      <Button onPress={create}>Create Template</Button>
      <ScrollView>
        {items.map((tpl) => (
          <YStack key={tpl.id} bg="$secondary" br="$3" p="$3" mb="$2" gap="$2">
            <Paragraph color="white" fontWeight="700">{tpl.name}</Paragraph>
            <Paragraph color="$gray10">{tpl.prompt}</Paragraph>
            <XStack>
              <Button size="$2" onPress={() => createTask(tpl.id)}>Create Task</Button>
            </XStack>
          </YStack>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}
