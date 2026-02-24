import React, { useState } from 'react';
import { H3, Paragraph, ScrollView, YStack } from 'tamagui';
import { apiGet } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';

export function AuditsScreen() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    try {
      const data = await apiGet('/api/audits');
      setItems(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError('需要 admin token 才能查看 audits');
    }
  };
  usePolling(load, [], refreshSeconds * 1000);

  return (
    <YStack f={1} p="$3" gap="$3">
      <H3 color="white">Audits</H3>
      {!!error && <Paragraph color="$red10">{error}</Paragraph>}
      <ScrollView>
        {items.map((a) => (
          <YStack key={a.id} bg="$secondary" br="$3" p="$3" mb="$2" gap="$1">
            <Paragraph color="white" fontWeight="700">{a.action}</Paragraph>
            <Paragraph color="$gray10">{a.actor} · {a.role}</Paragraph>
            <Paragraph color="$gray10">{a.detail || '-'}</Paragraph>
          </YStack>
        ))}
      </ScrollView>
    </YStack>
  );
}
