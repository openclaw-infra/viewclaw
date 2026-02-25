import React, { useState } from 'react';
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
    if (!name.trim() || !prompt.trim()) return;
    await apiPost('/api/templates', { name, prompt, priority: 'medium' });
    setName('');
    setPrompt('');
    showToast('模板创建成功', 'success');
    load();
  };

  const createTask = async (templateId) => {
    await apiPost('/api/tasks', { templateId, title: '' });
    showToast('任务已从模板创建', 'success');
  };

  return (
    <ScreenShell title="模板" subtitle="模板管理（V3）" loading={loading} error={error}>
      <SurfaceCard>
        <View style={styles.formBody}>
          <AppInput
            label="模板名称"
            value={name}
            onChangeText={setName}
            placeholder="输入模板名称"
          />
          <AppInput
            label="提示词"
            value={prompt}
            onChangeText={setPrompt}
            placeholder="输入提示词"
            multiline
            inputStyle={styles.textArea}
          />
          <AppButton title="创建模板" onPress={create} disabled={!name.trim() || !prompt.trim()} />
        </View>
      </SurfaceCard>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#7dd3fc" />}
        contentContainerStyle={styles.scrollContent}
      >
        {items.length === 0 ? <EmptyState title="暂无模板" subtitle="创建模板后可一键生成任务" /> : items.map((tpl, index) => (
          <FadeInView key={tpl.id} delay={index * 35}>
            <SurfaceCard style={styles.tplCard}>
              <View style={styles.tplBody}>
                <Text style={styles.tplTitle}>{tpl.name}</Text>
                <Text style={styles.tplPrompt}>{tpl.prompt}</Text>
                <AppButton title="创建任务" small variant="info" onPress={() => createTask(tpl.id)} style={styles.taskBtn} />
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
    formBody: {
      padding: 12,
      gap: 8,
    },
    textArea: {
      minHeight: 96,
      textAlignVertical: 'top',
      paddingTop: 10,
    },
    scrollContent: { paddingBottom: 28, gap: 8 },
    tplCard: {
      marginBottom: 8,
    },
    tplBody: {
      padding: 12,
      gap: 8,
    },
    tplTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
    tplPrompt: { color: colors.muted, fontSize: 13 },
    taskBtn: { alignSelf: 'flex-start' },
  });
}
