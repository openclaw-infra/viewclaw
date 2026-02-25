import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { EmptyState } from '../components/EmptyState';
import { SurfaceCard } from '../components/SurfaceCard';
import { FadeInView } from '../components/FadeInView';
import { apiGet } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../store/useAppStore';
import { toErrorText } from '../utils/errorText';
import { usePalette } from '../theme';

export function AuditsScreen() {
  const colors = usePalette();
  const styles = getStyles(colors);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshSeconds = useAppStore((s) => s.refreshSeconds);

  const load = async () => {
    try {
      const data = await apiGet('/api/audits');
      setItems(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(toErrorText(e, '需要 admin token 才能查看 audits'));
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

  return (
    <ScreenShell title="审计" subtitle="审计日志（管理员）" loading={loading} error={error}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#7dd3fc" />}
        contentContainerStyle={styles.scrollContent}
      >
        {items.length === 0 ? <EmptyState title="暂无审计日志" subtitle="请确认使用 admin token，并触发一些任务操作" /> : items.map((a, index) => (
          <FadeInView key={a.id} delay={index * 30}>
            <SurfaceCard style={styles.auditCard}>
              <View style={styles.auditBody}>
                <Text style={styles.action}>{a.action}</Text>
                <Text style={styles.meta}>{a.actor} · {a.role}</Text>
                <Text style={styles.meta}>{a.detail || '-'}</Text>
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
    scrollContent: { paddingBottom: 28, gap: 8 },
    auditCard: {
      marginBottom: 8,
    },
    auditBody: {
      padding: 12,
      gap: 6,
    },
    action: { color: colors.text, fontWeight: '700', fontSize: 15 },
    meta: { color: colors.muted, fontSize: 12 },
  });
}
