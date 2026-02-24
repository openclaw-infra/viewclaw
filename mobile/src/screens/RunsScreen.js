import React, { useState } from 'react';
import { Alert } from 'react-native';
import { ScrollView, YStack, Input, Button, XStack } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell } from '../components/ScreenShell';
import { RunCard } from '../components/RunCard';
import { ToastBanner } from '../components/ToastBanner';
import { EmptyState } from '../components/EmptyState';
import { apiGet, apiPost } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';
import { toErrorText } from '../utils/errorText';

export function RunsScreen() {
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    try {
      const data = await apiGet('/api/runs');
      setRuns(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(toErrorText(e, 'Failed to load runs'));
    } finally {
      setLoading(false);
    }
  };

  usePolling(load, [refreshSeconds], refreshSeconds * 1000);

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const finalize = async (id, status) => {
    try {
      await apiPost(`/api/runs/${id}/finalize`, status === 'done' 
        ? { status, result: 'Manual finalize from mobile' } 
        : { status, error: 'Manual fail from mobile' }
      );
      showToast(status === 'done' ? 'Run finalized (Done)' : 'Run finalized (Failed)', 'success');
      load();
    } catch {
      showToast('Finalize failed', 'error');
    }
  };

  const onAction = (run, action) => {
    Alert.alert(
      `Finalize Run`,
      `Mark run ${run.id.slice(0, 8)} as ${action}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: action === 'failed' ? 'destructive' : 'default',
          onPress: () => finalize(run.id, action)
        },
      ]
    );
  };

  return (
    <ScreenShell 
      title="Runs" 
      subtitle="Execution History" 
      loading={loading} 
      error={error}
    >
      {toast && <ToastBanner text={toast.text} type={toast.type} />}
      
      <XStack gap="$2" mb="$4">
        <Input 
          f={1} 
          value={runId} 
          onChangeText={setRunId} 
          placeholder="Finalize Run ID..." 
          bg="$card" 
          borderColor="$border"
        />
        <Button 
          onPress={() => finalize(runId, 'done')}
          bg="$primary"
          color="white"
        >
          <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
          Done
        </Button>
      </XStack>

      <ScrollView showsVerticalScrollIndicator={false}>
        {runs.length === 0 && !loading ? (
          <EmptyState title="No Runs" subtitle="Trigger tasks on the Board to see runs here" />
        ) : (
          <YStack gap="$3" pb="$8">
            {runs.map((run) => (
              <RunCard key={run.id} run={run} onAction={onAction} />
            ))}
          </YStack>
        )}
      </ScrollView>
    </ScreenShell>
  );
}
