import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Switch, XStack } from 'tamagui';
import { ScreenShell } from '../components/ScreenShell';
import { AppButton } from '../components/AppButton';
import { AppInput } from '../components/AppInput';
import { SurfaceCard } from '../components/SurfaceCard';
import { useAppStore } from '../store/useAppStore';
import { apiGet } from '../api/client';
import { toErrorText } from '../utils/errorText';
import { usePalette } from '../theme';

export function SettingsScreen() {
  const colors = usePalette();
  const styles = getStyles(colors);
  const { baseUrl, projectId, token, refreshSeconds, themeMode, setConnection, setRefreshSeconds, setThemeMode } = useAppStore();
  const [draft, setDraft] = useState({ baseUrl, projectId, token, refreshSeconds: String(refreshSeconds) });
  const [health, setHealth] = useState('');

  useEffect(() => {
    setDraft({ baseUrl, projectId, token, refreshSeconds: String(refreshSeconds) });
  }, [baseUrl, projectId, token, refreshSeconds]);

  const save = () => {
    setConnection({ baseUrl: draft.baseUrl, projectId: draft.projectId, token: draft.token });
    setRefreshSeconds(Math.max(3, Number(draft.refreshSeconds || 8)));
  };

  const check = async () => {
    try {
      const h = await apiGet('/health');
      setHealth(JSON.stringify(h));
    } catch (e) {
      setHealth(toErrorText(e, '连接失败'));
    }
  };

  return (
    <ScreenShell title="设置" subtitle="连接与运行参数" loading={false}>
      <SurfaceCard>
        <View style={styles.formBody}>
          <XStack ai="center" jc="space-between" px="$1" py="$1">
            <Text style={styles.themeLabel}>深色模式</Text>
            <Switch
              checked={themeMode === 'dark'}
              onCheckedChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
              backgroundColor={themeMode === 'dark' ? colors.primary : colors.card}
              borderColor={colors.cardBorder}
              borderWidth={1}
            >
              <Switch.Thumb animation="quick" backgroundColor={themeMode === 'dark' ? '#ecfeff' : colors.muted} />
            </Switch>
          </XStack>

          <AppInput label="API 地址" value={draft.baseUrl} onChangeText={(v) => setDraft((s) => ({ ...s, baseUrl: v }))} placeholder="输入 API 地址" />
          <AppInput label="项目 ID" value={draft.projectId} onChangeText={(v) => setDraft((s) => ({ ...s, projectId: v }))} placeholder="输入项目 ID" />
          <AppInput label="访问令牌" value={draft.token} onChangeText={(v) => setDraft((s) => ({ ...s, token: v }))} placeholder="输入 Bearer Token" />
          <AppInput label="刷新间隔（秒）" value={draft.refreshSeconds} onChangeText={(v) => setDraft((s) => ({ ...s, refreshSeconds: v }))} placeholder="最小 3 秒" keyboardType="numeric" />

          <AppButton title="保存设置" onPress={save} />
          <AppButton small title="健康检查" variant="info" onPress={check} />

          {!!health && (
            <SurfaceCard tone="soft" style={styles.healthBox}>
              <View style={styles.healthBody}>
                <Text style={styles.healthText}>{health}</Text>
              </View>
            </SurfaceCard>
          )}
        </View>
      </SurfaceCard>
    </ScreenShell>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    formBody: {
      padding: 12,
      gap: 8,
    },
    themeLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    healthBox: {
      marginTop: 2,
    },
    healthBody: {
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    healthText: { color: colors.muted, fontSize: 12 },
  });
}
