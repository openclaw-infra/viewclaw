import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { StatusPill } from '../components/StatusPill';
import { EmptyState } from '../components/EmptyState';
import { AppButton } from '../components/AppButton';
import { AppInput } from '../components/AppInput';
import { SurfaceCard } from '../components/SurfaceCard';
import { FadeInView } from '../components/FadeInView';
import { apiGet, apiPost } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';
import { toErrorText } from '../utils/errorText';
import { usePalette } from '../theme';

export function RunsScreen() {
  const colors = usePalette();
  const styles = getStyles(colors);
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);
  const showToast = useAppStore((s) => s.showToast);

  const load = async () => {
    try {
      const data = await apiGet('/api/runs');
      setRuns(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(toErrorText(e, '加载运行记录失败'));
    } finally {
      setLoading(false);
    }
  };
  usePolling(load, [refreshSeconds], refreshSeconds * 1000);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const finalize = async (id, status) => {
    try {
      await apiPost(`/api/runs/${id}/finalize`, status === 'done' ? { status, result: '移动端手动结束为完成' } : { status, error: '移动端手动结束为失败' });
      showToast(status === 'done' ? '运行已完成' : '运行已失败', status === 'done' ? 'success' : 'error');
      load();
    } catch {
      showToast('结束操作失败', 'error');
    }
  };

  const runningCount = useMemo(() => runs.filter((x) => x.status === 'running').length, [runs]);

  return (
    <ScreenShell title="运行记录" subtitle="执行记录（V2/V3）" loading={loading} error={error}>

      <SurfaceCard tone="soft">
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>总运行数</Text>
          <Text style={styles.summaryValue}>{runs.length}</Text>
          <Text style={styles.summaryLabel}>进行中</Text>
          <Text style={[styles.summaryValue, styles.running]}>{runningCount}</Text>
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.inputCard}>
        <View style={styles.inputBody}>
          <AppInput
            label="运行 ID"
            value={runId}
            onChangeText={setRunId}
            placeholder="输入要结束的运行 ID"
          />
          <AppButton small title="标记完成" variant="success" onPress={() => finalize(runId, 'done')} disabled={!runId.trim()} />
        </View>
      </SurfaceCard>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#7dd3fc" />}
        contentContainerStyle={styles.scrollContent}
      >
        {runs.length === 0 ? <EmptyState title="暂无执行记录" subtitle="先在看板页触发任务执行" /> : runs.map((run, index) => (
          <FadeInView key={run.id} delay={index * 35}>
            <SurfaceCard style={styles.runCard}>
              <View style={styles.runBody}>
                <View style={styles.rowMeta}>
                  <Text style={styles.runId}>{run.id.slice(0, 8)}</Text>
                  <StatusPill value={run.status} />
                </View>
                <Text style={styles.mutedText}>任务: {run.taskId}</Text>
                <Text style={styles.mutedText}>执行器: {run.executor}</Text>
                {!!run.externalSessionKey && <Text style={styles.sessionText}>会话: {run.externalSessionKey}</Text>}
                {run.status === 'running' && (
                  <View style={styles.actionsWrap}>
                    <AppButton
                      small
                      title="标记完成"
                      variant="success"
                      onPress={() => Alert.alert('确认完成', `确认将运行 ${run.id.slice(0, 8)} 标记为完成？`, [
                        { text: '取消', style: 'cancel' },
                        { text: '确定', onPress: () => finalize(run.id, 'done') },
                      ])}
                    />
                    <AppButton
                      small
                      title="标记失败"
                      variant="danger"
                      onPress={() => Alert.alert('确认失败', `确认将运行 ${run.id.slice(0, 8)} 标记为失败？`, [
                        { text: '取消', style: 'cancel' },
                        { text: '确定', style: 'destructive', onPress: () => finalize(run.id, 'failed') },
                      ])}
                    />
                  </View>
                )}
              </View>
            </SurfaceCard>
          </FadeInView>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    summaryLabel: {
      color: colors.subtle,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    summaryValue: {
      color: '#93c5fd',
      fontSize: 16,
      fontWeight: '800',
      marginRight: 8,
    },
    running: {
      color: '#5eead4',
      marginRight: 0,
    },
    inputCard: { marginTop: 2 },
    inputBody: { padding: 10, gap: 8 },
    scrollContent: { paddingBottom: 28, gap: 8 },
    runCard: { marginBottom: 8 },
    runBody: { padding: 12, gap: 6 },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    runId: { color: colors.text, fontWeight: '700', fontSize: 15 },
    mutedText: { color: colors.muted, fontSize: 12 },
    sessionText: { color: '#67e8f9', fontSize: 12 },
    actionsWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  });
}
