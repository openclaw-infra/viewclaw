import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { StatusPill } from '../components/StatusPill';
import { EmptyState } from '../components/EmptyState';
import { AppButton } from '../components/AppButton';
import { SurfaceCard } from '../components/SurfaceCard';
import { FadeInView } from '../components/FadeInView';
import { apiGet, apiPost } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';
import { toErrorText } from '../utils/errorText';
import { usePalette } from '../theme';

export function BoardScreen() {
  const colors = usePalette();
  const styles = getStyles(colors);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);
  const showToast = useAppStore((s) => s.showToast);

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

  const groups = useMemo(() => ({
    queued: tasks.filter((x) => x.status === 'queued'),
    'in-progress': tasks.filter((x) => x.status === 'in-progress'),
    done: tasks.filter((x) => x.status === 'done'),
    failed: tasks.filter((x) => x.status === 'failed'),
  }), [tasks]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const act = async (task, type) => {
    try {
      if (type === 'pickup') await apiPost(`/api/tasks/${task.id}/pickup`);
      if (type === 'complete') await apiPost(`/api/tasks/${task.id}/complete`, { result: '移动端手动标记完成' });
      if (type === 'fail') await apiPost(`/api/tasks/${task.id}/fail`, { error: '移动端手动标记失败' });
      showToast(`任务 ${type} 成功`, 'success');
      await load();
    } catch {
      showToast(`任务 ${type} 失败`, 'error');
    }
  };

  return (
    <ScreenShell
      title="看板"
      subtitle="任务看板（V1/V2）"
      loading={loading}
      error={error}
      right={<AppButton small title="触发调度" onPress={() => apiPost('/api/worker/tick').then(() => { showToast('调度已触发', 'success'); load(); }).catch(() => showToast('调度失败', 'error'))} />}
    >

      <SurfaceCard style={styles.statsCard} tone="soft">
        <View style={styles.statsWrap}>
          <StatItem styles={styles} label="总计" value={tasks.length} color="#93c5fd" />
          <StatItem styles={styles} label="进行中" value={groups['in-progress'].length} color="#5eead4" />
          <StatItem styles={styles} label="已完成" value={groups.done.length} color="#86efac" />
          <StatItem styles={styles} label="失败" value={groups.failed.length} color="#fca5a5" />
        </View>
      </SurfaceCard>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#7dd3fc" />}
        contentContainerStyle={styles.scrollContent}
      >
        {tasks.length === 0 ? (
          <EmptyState title="暂无任务" subtitle="先去模板页创建模板，再一键生成任务" />
        ) : Object.entries(groups).map(([key, list], index) => (
          <FadeInView key={key} delay={index * 45}>
            <SurfaceCard style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{key.toUpperCase()}</Text>
                <Text style={styles.groupCount}>{list.length}</Text>
              </View>

              {list.length === 0 ? (
                <Text style={styles.mutedText}>暂无任务</Text>
              ) : (
                list.map((task, taskIndex) => (
                  <FadeInView key={task.id} delay={120 + taskIndex * 28}>
                    <SurfaceCard tone="soft" style={styles.taskCard}>
                      <View style={styles.taskBody}>
                        <View style={styles.rowBetween}>
                          <Text numberOfLines={1} style={styles.taskTitle}>{task.title}</Text>
                          <AppButton small title="详情" variant="ghost" onPress={() => setSelectedTask(task)} />
                        </View>

                        <View style={styles.rowMeta}>
                          <StatusPill value={task.status} />
                          <Text style={styles.mutedText}>{task.priority} · retry {task.retryCount}/{task.maxRetries}</Text>
                        </View>

                        {!!task.error && <Text style={styles.errorText}>{task.error}</Text>}
                        {!!task.result && <Text style={styles.successText}>{task.result}</Text>}

                        <View style={styles.actionsWrap}>
                          {task.status !== 'in-progress' && task.status !== 'done' && (
                            <AppButton small title="领取" variant="info" onPress={() => act(task, 'pickup')} />
                          )}
                          {task.status !== 'done' && (
                            <AppButton
                              small
                              title="完成"
                              variant="success"
                              onPress={() => Alert.alert('确认完成', `确定将任务「${task.title}」标记为完成吗？`, [
                                { text: '取消', style: 'cancel' },
                                { text: '确定', onPress: () => act(task, 'complete') },
                              ])}
                            />
                          )}
                          {task.status !== 'failed' && task.status !== 'done' && (
                            <AppButton
                              small
                              title="失败"
                              variant="danger"
                              onPress={() => Alert.alert('确认失败', `确定将任务「${task.title}」标记为失败吗？`, [
                                { text: '取消', style: 'cancel' },
                                { text: '确定', style: 'destructive', onPress: () => act(task, 'fail') },
                              ])}
                            />
                          )}
                        </View>
                      </View>
                    </SurfaceCard>
                  </FadeInView>
                ))
              )}
            </SurfaceCard>
          </FadeInView>
        ))}
      </ScrollView>

      {!!selectedTask && (
        <SurfaceCard style={styles.detailCard}>
          <View style={styles.detailBody}>
            <View style={styles.rowBetween}>
              <Text style={styles.groupTitle}>任务详情</Text>
              <AppButton small title="关闭" variant="ghost" onPress={() => setSelectedTask(null)} />
            </View>
            <Text style={styles.mutedText}>id: {selectedTask.id}</Text>
            <Text style={styles.mutedText}>title: {selectedTask.title}</Text>
            <Text style={styles.mutedText}>status: {selectedTask.status}</Text>
            <Text style={styles.mutedText}>skill: {selectedTask.skill || '-'}</Text>
            <Text style={styles.mutedText}>updatedAt: {selectedTask.updatedAt}</Text>
          </View>
        </SurfaceCard>
      )}
    </ScreenShell>
  );
}

function StatItem({ styles, label, value, color }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    statsCard: {
      marginBottom: 2,
    },
    statsWrap: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    statItem: {
      alignItems: 'center',
      gap: 2,
    },
    statLabel: {
      color: '#9fb4c8',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.9,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '800',
    },
    scrollContent: { paddingBottom: 28, gap: 12 },
    groupCard: {
      marginBottom: 12,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    groupTitle: { color: colors.text, fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
    groupCount: { color: '#7dd3fc', fontWeight: '700', fontSize: 14 },
    taskCard: {
      marginHorizontal: 10,
      marginBottom: 10,
    },
    taskBody: {
      padding: 10,
      gap: 8,
    },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    taskTitle: { color: colors.text, fontWeight: '700', fontSize: 14, flex: 1 },
    mutedText: { color: colors.muted, fontSize: 12 },
    errorText: { color: '#fca5a5', fontSize: 12 },
    successText: { color: '#86efac', fontSize: 12 },
    actionsWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    detailCard: {
      marginTop: 2,
    },
    detailBody: {
      padding: 12,
      gap: 6,
    },
  });
}
