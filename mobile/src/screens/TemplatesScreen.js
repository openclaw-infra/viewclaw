import React, { useState } from 'react';
import { Button, H3, Input, Paragraph, ScrollView, TextArea, XStack, YStack } from 'tamagui';
import { apiGet, apiPost } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';

export function TemplatesScreen() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    const data = await apiGet('/api/templates');
    setItems(Array.isArray(data) ? data : []);
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
    <YStack f={1} p="$3" gap="$3">
      <H3 color="white">Templates</H3>
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
    </YStack>
  );
}
