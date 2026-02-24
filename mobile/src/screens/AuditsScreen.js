import React, { useState } from 'react';
import { Paragraph, ScrollView, YStack } from 'tamagui';
import { ScreenShell } from '../components/ScreenShell';
import { EmptyState } from '../components/EmptyState';
import { apiGet } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';

export function AuditsScreen() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    try {
      const data = await apiGet('/api/audits');
      setItems(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError('需要 admin token 才能查看 audits');
    } finally {
      setLoading(false);
    }
  };
  usePolling(load, [], refreshSeconds * 1000);

  return (
    <ScreenShell title="Audits" subtitle="审计日志（admin）" loading={loading} error={error}>
      <ScrollView>
        {items.length === 0 ? <EmptyState title="暂无审计日志" subtitle="请确认使用 admin token，并触发一些任务操作" /> : items.map((a) => (
          <YStack key={a.id} bg="$secondary" br="$3" p="$3" mb="$2" gap="$1">
            <Paragraph color="white" fontWeight="700">{a.action}</Paragraph>
            <Paragraph color="$gray10">{a.actor} · {a.role}</Paragraph>
            <Paragraph color="$gray10">{a.detail || '-'}</Paragraph>
          </YStack>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}
