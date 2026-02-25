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

const GROUP_META = {
  queued: { title: '待执行', hint: '等待调度器执行' },
  'in-progress': { title: '执行中', hint: '任务已提交到执行流程' },
  done: { title: '已完成', hint: '已返回结果' },
  failed: { title: '失败', hint: '可查看错误并重试' },
};

const ACTION_LABEL = {
  execute: '立即执行',
  complete: '标记完成',
  fail: '标记失败',
  detail: '详情',
};

function statusText(status) {
  if (status === 'queued') return '待执行';
  if (status === 'in-progress') return '执行中';
  if (status === 'done') return '已完成';
  if (status === 'failed') return '失败';
  return status;
}

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

  const groups = useMemo(
    () => ({
      queued: tasks.filter((x) => x.status === 'queued'),
      'in-progress': tasks.filter((x) => x.status === 'in-progress'),
      done: tasks.filter((x) => x.status === 'done'),
      failed: tasks.filter((x) => x.status === 'failed'),
    }),
    [tasks]
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const triggerDispatch = async () => {
    try {
      const res = await apiPost('/api/worker/tick');
      if (res?.taskId) {
        showToast(`已调度任务 ${String(res.taskId).slice(0, 8)}`, 'success');
      } else {
        showToast(res?.message || '当前无可调度任务', 'info');
      }
      await load();
    } catch (e) {
      showToast(toErrorText(e, '触发调度失败'), 'error');
    }
  };

  const executeTask = async (task) => {
    try {
      if (task.status === 'queued') {
        await apiPost(`/api/tasks/${task.id}/pickup`);
      }
      const res = await apiPost('/api/worker/tick');
      if (res?.taskId) {
        showToast('任务已进入执行流程', 'success');
      } else {
        showToast(res?.message || '执行器暂时未接到任务', 'info');
      }
      await load();
    } catch (e) {
      showToast(toErrorText(e, '执行任务失败'), 'error');
    }
  };

  const updateTaskStatus = async (task, type) => {
    try {
      if (type === 'complete') await apiPost(`/api/tasks/${task.id}/complete`, { result: '移动端手动标记完成' });
      if (type === 'fail') await apiPost(`/api/tasks/${task.id}/fail`, { error: '移动端手动标记失败' });
      showToast(`${ACTION_LABEL[type]}成功`, 'success');
      await load();
    } catch (e) {
      showToast(toErrorText(e, `${ACTION_LABEL[type]}失败`), 'error');
    }
  };

  const openTaskDetail = async (task) => {
    try {
      const detail = await apiGet(`/api/tasks/${task.id}`);
      setSelectedTask(detail || task);
    } catch {
      setSelectedTask(task);
    }
  };

  return (
    <ScreenShell
      title="任务看板"
      subtitle="创建任务、调度执行、查看状态"
      loading={loading}
      error={error}
      right={<AppButton small title="触发调度" onPress={triggerDispatch} />}
    >
      <SurfaceCard style={styles.statsCard} tone="soft">
        <View style={styles.statsWrap}>
          <StatItem styles={styles} label="总任务" value={tasks.length} color="#93c5fd" />
          <StatItem styles={styles} label="执行中" value={groups['in-progress'].length} color="#5eead4" />
          <StatItem styles={styles} label="完成" value={groups.done.length} color="#86efac" />
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
        ) : (
          Object.entries(groups).map(([key, list], index) => {
            const meta = GROUP_META[key];
            return (
              <FadeInView key={key} delay={index * 35}>
                <SurfaceCard style={styles.groupCard}>
                  <View style={styles.groupHeader}>
                    <View>
                      <Text style={styles.groupTitle}>{meta.title}</Text>
                      <Text style={styles.groupHint}>{meta.hint}</Text>
                    </View>
                    <Text style={styles.groupCount}>{list.length}</Text>
                  </View>

                  {list.length === 0 ? (
                    <Text style={styles.emptyHint}>当前分组暂无任务</Text>
                  ) : (
                    list.map((task, taskIndex) => (
                      <FadeInView key={task.id} delay={120 + taskIndex * 24}>
                        <SurfaceCard tone="soft" style={styles.taskCard}>
                          <View style={styles.taskBody}>
                            <View style={styles.rowBetween}>
                              <Text numberOfLines={1} style={styles.taskTitle}>{task.title}</Text>
                              <StatusPill value={task.status} />
                            </View>

                            <View style={styles.metaLine}>
                              <Text style={styles.metaLabel}>优先级</Text>
                              <Text style={styles.metaValue}>{task.priority || '-'}</Text>
                              <Text style={styles.metaLabel}>重试</Text>
                              <Text style={styles.metaValue}>{task.retryCount}/{task.maxRetries}</Text>
                              <Text style={styles.metaLabel}>状态</Text>
                              <Text style={styles.metaValue}>{statusText(task.status)}</Text>
                            </View>

                            {!!task.error && <Text style={styles.errorText}>{task.error}</Text>}
                            {!!task.result && <Text style={styles.successText}>{task.result}</Text>}

                            <View style={styles.actionsWrap}>
                              {(task.status === 'queued' || task.status === 'in-progress') && (
                                <AppButton small title="立即执行" variant="info" onPress={() => executeTask(task)} />
                              )}
                              {task.status !== 'done' && (
                                <AppButton
                                  small
                                  title="标记完成"
                                  variant="success"
                                  onPress={() =>
                                    Alert.alert('确认完成', `确定将任务「${task.title}」标记为完成吗？`, [
                                      { text: '取消', style: 'cancel' },
                                      { text: '确定', onPress: () => updateTaskStatus(task, 'complete') },
                                    ])
                                  }
                                />
                              )}
                              {task.status !== 'failed' && task.status !== 'done' && (
                                <AppButton
                                  small
                                  title="标记失败"
                                  variant="danger"
                                  onPress={() =>
                                    Alert.alert('确认失败', `确定将任务「${task.title}」标记为失败吗？`, [
                                      { text: '取消', style: 'cancel' },
                                      { text: '确定', style: 'destructive', onPress: () => updateTaskStatus(task, 'fail') },
                                    ])
                                  }
                                />
                              )}
                              <AppButton small title="详情" variant="ghost" onPress={() => openTaskDetail(task)} />
                            </View>
                          </View>
                        </SurfaceCard>
                      </FadeInView>
                    ))
                  )}
                </SurfaceCard>
              </FadeInView>
            );
          })
        )}
      </ScrollView>

      {!!selectedTask && (
        <SurfaceCard style={styles.detailCard}>
          <View style={styles.detailBody}>
            <View style={styles.rowBetween}>
              <Text style={styles.detailTitle}>任务详情</Text>
              <AppButton small title="关闭" variant="ghost" onPress={() => setSelectedTask(null)} />
            </View>
            <Text style={styles.detailText}>任务ID: {selectedTask.id}</Text>
            <Text style={styles.detailText}>标题: {selectedTask.title}</Text>
            <Text style={styles.detailText}>状态: {statusText(selectedTask.status)}</Text>
            <Text style={styles.detailText}>技能: {selectedTask.skill || '-'}</Text>
            <Text style={styles.detailText}>更新时间: {selectedTask.updatedAt || '-'}</Text>
            <Text style={styles.detailText}>运行数: {(selectedTask.runs || []).length}</Text>
            {(selectedTask.runs || []).slice(0, 2).map((run) => (
              <Text key={run.id} style={styles.runHint}>- {run.id.slice(0, 8)} · {run.status} · {run.executor}</Text>
            ))}
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
    statsCard: { marginBottom: 4 },
    statsWrap: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    statItem: { alignItems: 'center', gap: 2 },
    statLabel: {
      color: '#9fb4c8',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.9,
    },
    statValue: { fontSize: 16, fontWeight: '800' },
    scrollContent: { paddingBottom: 28, gap: 12 },
    groupCard: { marginBottom: 10 },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    groupTitle: { color: colors.text, fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },
    groupHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
    groupCount: { color: '#7dd3fc', fontWeight: '800', fontSize: 16 },
    emptyHint: { color: colors.muted, fontSize: 12, paddingHorizontal: 12, paddingVertical: 12 },
    taskCard: { marginHorizontal: 10, marginBottom: 10 },
    taskBody: { padding: 10, gap: 8 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    taskTitle: { color: colors.text, fontWeight: '800', fontSize: 14, flex: 1 },
    metaLine: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: 8,
      rowGap: 4,
      backgroundColor: colors.panel,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    metaLabel: { color: colors.subtle, fontSize: 11, fontWeight: '700' },
    metaValue: { color: colors.text, fontSize: 11, fontWeight: '700' },
    errorText: { color: '#fca5a5', fontSize: 12 },
    successText: { color: '#86efac', fontSize: 12 },
    actionsWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    detailCard: { marginTop: 2 },
    detailBody: { padding: 12, gap: 6 },
    detailTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
    detailText: { color: colors.muted, fontSize: 12 },
    runHint: { color: '#93c5fd', fontSize: 12 },
  });
}
