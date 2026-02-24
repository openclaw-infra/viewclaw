import React, { useState } from 'react';
import { Text, ScrollView, YStack } from 'tamagui';
import { ScreenShell } from '../components/ScreenShell';
import { EmptyState } from '../components/EmptyState';
import { apiGet } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';
import { toErrorText } from '../utils/errorText';

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
      setError(toErrorText(e, 'Admin token required for audits'));
    } finally {
      setLoading(false);
    }
  };
  usePolling(load, [refreshSeconds], refreshSeconds * 1000);

  return (
    <ScreenShell title="Audits" subtitle="Operation History" loading={loading} error={error}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <EmptyState title="No Audit Logs" subtitle="Use an admin token and perform task actions" />
        ) : (
          items.map((a) => (
            <YStack key={a.id} bg="$card" br="$4" p="$4" mb="$3" gap="$1" borderWidth={1} borderColor="$border">
              <Text color="$text" fontWeight="700">{a.action}</Text>
              <Text color="$textMuted">{a.actor} · {a.role}</Text>
              <Text color="$textSubtle">{a.detail || '-'}</Text>
            </YStack>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}
