import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const statusMeta = {
  queued: { bg: '#7c2d121f', border: '#fb923c', color: '#fdba74' },
  'in-progress': { bg: '#1d4ed81f', border: '#60a5fa', color: '#93c5fd' },
  done: { bg: '#14532d1f', border: '#4ade80', color: '#86efac' },
  failed: { bg: '#7f1d1d1f', border: '#f87171', color: '#fca5a5' },
  running: { bg: '#0f766e1f', border: '#2dd4bf', color: '#5eead4' },
};

export function StatusPill({ value }) {
  const meta = statusMeta[value] || { bg: '#33415533', border: '#94a3b8', color: '#cbd5e1' };
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
      <Text style={[styles.text, { color: meta.color }]}>{String(value || 'unknown').toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
