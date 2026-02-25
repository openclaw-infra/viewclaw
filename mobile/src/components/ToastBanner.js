import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { radius, useThemeMode } from '../theme';

const bannerMapDark = {
  error: { bg: '#7f1d1d1f', border: '#ef4444', text: '#fecaca' },
  success: { bg: '#14532d1f', border: '#22c55e', text: '#bbf7d0' },
  info: { bg: '#155e751f', border: '#22d3ee', text: '#cffafe' },
};

const bannerMapLight = {
  error: { bg: '#fff1f2', border: '#dc2626', text: '#9f1239' },
  success: { bg: '#ecfdf5', border: '#16a34a', text: '#166534' },
  info: { bg: '#eff6ff', border: '#2563eb', text: '#1e3a8a' },
};

export function ToastBanner({ text, type = 'info', floating = false }) {
  const mode = useThemeMode();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!text) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [anim, text]);

  if (!text) return null;
  const map = mode === 'dark' ? bannerMapDark : bannerMapLight;
  const s = map[type] || map.info;

  return (
    <Animated.View
      style={[
        floating ? styles.floatingWrap : styles.wrap,
        {
          backgroundColor: s.bg,
          borderColor: s.border,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-6, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={[styles.text, { color: s.text }]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  floatingWrap: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 180,
    maxWidth: 320,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
  },
});
