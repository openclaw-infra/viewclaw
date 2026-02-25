import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
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

export function TemplatesScreen() {
  const colors = usePalette();
  const styles = getStyles(colors);
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);
  const showToast = useAppStore((s) => s.showToast);

  const canCreate = useMemo(() => name.trim() && prompt.trim(), [name, prompt]);

  const load = async () => {
    try {
      const data = await apiGet('/api/templates');
      setItems(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(toErrorText(e, '加载模板失败'));
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

  const create = async () => {
    if (!canCreate) return;
    try {
      await apiPost('/api/templates', { name: name.trim(), prompt: prompt.trim(), priority: 'medium' });
      setName('');
      setPrompt('');
      showToast('模板创建成功', 'success');
      await load();
    } catch (e) {
      showToast(toErrorText(e, '模板创建失败'), 'error');
    }
  };

  const createTask = async (templateId) => {
    try {
      await apiPost('/api/tasks', { templateId });
      showToast('任务已从模板创建', 'success');
    } catch (e) {
      showToast(toErrorText(e, '创建任务失败'), 'error');
    }
  };

  return (
    <ScreenShell title="模板中心" subtitle="管理可复用模板，一键生成任务" loading={loading} error={error}>
      <SurfaceCard>
        <View style={styles.formBody}>
          <Text style={styles.formTitle}>新建模板</Text>
          <Text style={styles.formSub}>模板将用于批量和快速建任务</Text>
          <AppInput label="模板名称" value={name} onChangeText={setName} placeholder="例如：日报检查" />
          <AppInput
            label="提示词"
            value={prompt}
            onChangeText={setPrompt}
            placeholder="描述任务执行目标、步骤和输出格式"
            multiline
            inputStyle={styles.textArea}
          />
          <AppButton title="创建模板" onPress={create} disabled={!canCreate} />
        </View>
      </SurfaceCard>

      <SurfaceCard tone="soft" style={styles.counterCard}>
        <View style={styles.counterWrap}>
          <Text style={styles.counterLabel}>模板总数</Text>
          <Text style={styles.counterValue}>{items.length}</Text>
        </View>
      </SurfaceCard>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#7dd3fc" />}
        contentContainerStyle={styles.scrollContent}
      >
        {items.length === 0 ? (
          <EmptyState title="暂无模板" subtitle="先创建一个模板，再生成任务" />
        ) : (
          items.map((tpl, index) => (
            <FadeInView key={tpl.id} delay={index * 30}>
              <SurfaceCard style={styles.tplCard}>
                <View style={styles.tplBody}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.tplTitle}>{tpl.name}</Text>
                    <Text style={styles.tplMeta}>{tpl.priority || 'medium'}</Text>
                  </View>
                  <Text style={styles.tplPrompt}>{tpl.prompt}</Text>
                  <View style={styles.footerRow}>
                    <Text style={styles.tplMeta}>ID: {tpl.id.slice(0, 8)}</Text>
                    <AppButton title="创建任务" small variant="info" onPress={() => createTask(tpl.id)} style={styles.taskBtn} />
                  </View>
                </View>
              </SurfaceCard>
            </FadeInView>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    formBody: { padding: 12, gap: 8 },
    formTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
    formSub: { color: colors.muted, fontSize: 12, marginBottom: 2 },
    textArea: { minHeight: 96, textAlignVertical: 'top', paddingTop: 10 },
    counterCard: { marginTop: 4 },
    counterWrap: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    counterLabel: { color: '#9fb4c8', fontSize: 11, fontWeight: '700', letterSpacing: 0.7 },
    counterValue: { color: '#7dd3fc', fontSize: 18, fontWeight: '800' },
    scrollContent: { paddingBottom: 28, gap: 8 },
    tplCard: { marginBottom: 8 },
    tplBody: { padding: 12, gap: 8 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    tplTitle: { color: colors.text, fontWeight: '800', fontSize: 15, flex: 1 },
    tplPrompt: { color: colors.muted, fontSize: 13, lineHeight: 18 },
    tplMeta: { color: '#9fb4c8', fontSize: 11, fontWeight: '700' },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    taskBtn: { alignSelf: 'flex-start' },
  });
}
