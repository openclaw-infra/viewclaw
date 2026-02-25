import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { usePalette } from '../theme';
import { SurfaceCard } from './SurfaceCard';

export function EmptyState({ title = '暂无数据', subtitle = '可以先创建一个任务', actionText, onAction }) {
  const colors = usePalette();
  const styles = getStyles(colors);

  return (
    <SurfaceCard>
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {actionText && onAction ? <AppButton title={actionText} onPress={onAction} /> : null}
      </View>
    </SurfaceCard>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 24,
      paddingHorizontal: 14,
    },
    title: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    subtitle: {
      color: colors.muted,
      textAlign: 'center',
      fontSize: 13,
      marginBottom: 4,
    },
  });
}
