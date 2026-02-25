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

const GROUPS = [
  { key: 'running', title: '运行中' },
  { key: 'done', title: '已完成' },
  { key: 'failed', title: '已失败' },
];

export function RunsScreen() {
  const colors = usePalette();
  const styles = getStyles(colors);
  const [runs, setRuns] = useState([]);
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

  const grouped = useMemo(
    () => ({
      running: runs.filter((x) => x.status === 'running'),
      done: runs.filter((x) => x.status === 'done'),
      failed: runs.filter((x) => x.status === 'failed'),
    }),
    [runs]
  );

  const finalize = async (id, status) => {
    try {
      await apiPost(
        `/api/runs/${id}/finalize`,
        status === 'done' ? { status, result: '移动端手动结束为完成' } : { status, error: '移动端手动结束为失败' }
      );
      showToast(status === 'done' ? '运行已标记完成' : '运行已标记失败', status === 'done' ? 'success' : 'error');
      await load();
    } catch (e) {
      showToast(toErrorText(e, '结束运行失败'), 'error');
    }
  };

  return (
    <ScreenShell title="运行详情" subtitle="查看任务执行过程与结果" loading={loading} error={error}>
      <SurfaceCard tone="soft">
        <View style={styles.summaryRow}>
          <SummaryItem styles={styles} label="总运行" value={runs.length} color="#93c5fd" />
          <SummaryItem styles={styles} label="运行中" value={grouped.running.length} color="#5eead4" />
          <SummaryItem styles={styles} label="已完成" value={grouped.done.length} color="#86efac" />
          <SummaryItem styles={styles} label="已失败" value={grouped.failed.length} color="#fca5a5" />
        </View>
      </SurfaceCard>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#7dd3fc" />}
        contentContainerStyle={styles.scrollContent}
      >
        {runs.length === 0 ? (
          <EmptyState title="暂无执行记录" subtitle="先在看板页执行一个任务" />
        ) : (
          GROUPS.map((group, idx) => (
            <FadeInView key={group.key} delay={idx * 30}>
              <SurfaceCard style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <Text style={styles.groupCount}>{grouped[group.key].length}</Text>
                </View>

                {grouped[group.key].length === 0 ? (
                  <Text style={styles.emptyHint}>当前分组暂无记录</Text>
                ) : (
                  grouped[group.key].map((run, runIndex) => (
                    <FadeInView key={run.id} delay={80 + runIndex * 20}>
                      <SurfaceCard tone="soft" style={styles.runCard}>
                        <View style={styles.runBody}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.runId}>{run.id.slice(0, 8)}</Text>
                            <StatusPill value={run.status} />
                          </View>

                          <Text style={styles.meta}>任务ID: {run.taskId}</Text>
                          <Text style={styles.meta}>执行器: {run.executor || '-'}</Text>
                          <Text style={styles.meta}>开始时间: {run.startedAt || '-'}</Text>
                          {!!run.finishedAt && <Text style={styles.meta}>结束时间: {run.finishedAt}</Text>}
                          {!!run.externalSessionKey && <Text style={styles.session}>OpenClaw 会话: {run.externalSessionKey}</Text>}

                          {Array.isArray(run.logs) && run.logs.length > 0 && (
                            <View style={styles.logBox}>
                              <Text style={styles.logTitle}>日志摘要</Text>
                              {run.logs.slice(-3).map((line, i) => (
                                <Text key={`${run.id}-${i}`} style={styles.logLine}>- {line}</Text>
                              ))}
                            </View>
                          )}

                          {run.status === 'running' && (
                            <View style={styles.actionsWrap}>
                              <AppButton
                                small
                                title="标记完成"
                                variant="success"
                                onPress={() =>
                                  Alert.alert('确认完成', `确认将运行 ${run.id.slice(0, 8)} 标记为完成？`, [
                                    { text: '取消', style: 'cancel' },
                                    { text: '确定', onPress: () => finalize(run.id, 'done') },
                                  ])
                                }
                              />
                              <AppButton
                                small
                                title="标记失败"
                                variant="danger"
                                onPress={() =>
                                  Alert.alert('确认失败', `确认将运行 ${run.id.slice(0, 8)} 标记为失败？`, [
                                    { text: '取消', style: 'cancel' },
                                    { text: '确定', style: 'destructive', onPress: () => finalize(run.id, 'failed') },
                                  ])
                                }
                              />
                            </View>
                          )}
                        </View>
                      </SurfaceCard>
                    </FadeInView>
                  ))
                )}
              </SurfaceCard>
            </FadeInView>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

function SummaryItem({ styles, label, value, color }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 6,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryLabel: { color: '#9fb4c8', fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
    summaryValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
    scrollContent: { paddingBottom: 28, gap: 10 },
    groupCard: { marginBottom: 8 },
    groupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    groupTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
    groupCount: { color: '#7dd3fc', fontSize: 15, fontWeight: '800' },
    emptyHint: { color: colors.muted, fontSize: 12, paddingHorizontal: 12, paddingVertical: 12 },
    runCard: { marginHorizontal: 10, marginBottom: 10 },
    runBody: { padding: 10, gap: 6 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    runId: { color: colors.text, fontWeight: '800', fontSize: 14 },
    meta: { color: colors.muted, fontSize: 12 },
    session: { color: '#67e8f9', fontSize: 12, fontWeight: '700' },
    logBox: {
      marginTop: 2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      gap: 2,
      backgroundColor: colors.panel,
    },
    logTitle: { color: colors.text, fontSize: 11, fontWeight: '700' },
    logLine: { color: colors.muted, fontSize: 11 },
    actionsWrap: { flexDirection: 'row', gap: 8, marginTop: 4 },
  });
}
