import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from 'tamagui';
import { BoardScreen } from './src/screens/BoardScreen';
import { RunsScreen } from './src/screens/RunsScreen';
import { TemplatesScreen } from './src/screens/TemplatesScreen';
import { AuditsScreen } from './src/screens/AuditsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ToastBanner } from './src/components/ToastBanner';
import { useAppStore } from './src/store/useAppStore';
import { usePalette, useThemeMode } from './src/theme';
import config from './tamagui.config';

const tabs = [
  { value: 'board', icon: 'board' },
  { value: 'runs', icon: 'runs' },
  { value: 'templates', icon: 'templates' },
  { value: 'audits', icon: 'audits' },
  { value: 'settings', icon: 'settings' },
];

export default function App() {
  const themeMode = useThemeMode();
  const colors = usePalette();
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);

  const [tab, setTab] = useState('board');
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const activeX = useRef(new Animated.Value(0)).current;

  const tabIndex = tabs.findIndex((x) => x.value === tab);

  useEffect(() => {
    if (!tabBarWidth) return;
    const segment = tabBarWidth / tabs.length;
    Animated.spring(activeX, {
      toValue: segment * tabIndex,
      useNativeDriver: true,
      damping: 16,
      stiffness: 180,
      mass: 0.8,
    }).start();
  }, [activeX, tabBarWidth, tabIndex]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => hideToast(), 1800);
    return () => clearTimeout(timer);
  }, [toast.visible, hideToast]);

  const screen = useMemo(() => {
    if (tab === 'board') return <BoardScreen />;
    if (tab === 'runs') return <RunsScreen />;
    if (tab === 'templates') return <TemplatesScreen />;
    if (tab === 'audits') return <AuditsScreen />;
    return <SettingsScreen />;
  }, [tab]);

  const segmentWidth = tabBarWidth ? tabBarWidth / tabs.length : 0;
  const styles = getStyles(colors);

  return (
    <TamaguiProvider config={config} defaultTheme={themeMode === 'dark' ? 'dark_app' : 'light_app'}>
      <Theme name={themeMode === 'dark' ? 'dark_app' : 'light_app'}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
            <StatusBar barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} />
            <View style={styles.bgBubbleTop} />
            <View style={styles.bgBubbleBottom} />

            <View style={styles.contentWrap}>{screen}</View>

            <View style={styles.tabBar} onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}>
              {!!segmentWidth && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.activePill,
                    {
                      width: segmentWidth - 8,
                      transform: [{ translateX: activeX }, { translateY: 0 }],
                    },
                  ]}
                />
              )}

              {tabs.map((item) => {
                const active = item.value === tab;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setTab(item.value)}
                    style={({ pressed }) => [styles.tabBtn, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <TabIcon type={item.icon} active={active} styles={styles} />
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.brand}>视爪移动端</Text>

            {toast.visible ? (
              <View pointerEvents="none" style={styles.toastOverlay}>
                <ToastBanner text={toast.text} type={toast.type} floating />
              </View>
            ) : null}
          </SafeAreaView>
        </SafeAreaProvider>
      </Theme>
    </TamaguiProvider>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    bgBubbleTop: {
      position: 'absolute',
      top: -120,
      right: -80,
      width: 240,
      height: 240,
      borderRadius: 999,
      backgroundColor: '#0ea5e91f',
    },
    bgBubbleBottom: {
      position: 'absolute',
      bottom: 40,
      left: -90,
      width: 220,
      height: 220,
      borderRadius: 999,
      backgroundColor: '#14b8a61f',
    },
    contentWrap: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    tabBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      padding: 6,
      marginHorizontal: 8,
      marginBottom: 6,
      backgroundColor: colors.tabBg,
      borderWidth: 1,
      borderColor: colors.tabBorder,
      borderRadius: 22,
      position: 'relative',
      overflow: 'hidden',
    },
    activePill: {
      position: 'absolute',
      left: 4,
      top: 4,
      bottom: 4,
      borderRadius: 14,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.tabActiveBorder,
    },
    tabBtn: {
      flex: 1,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingHorizontal: 4,
    },
    iconWrap: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    iconStroke: {
      position: 'absolute',
    },
    brand: {
      alignSelf: 'center',
      marginBottom: 8,
      color: colors.brand,
      fontSize: 11,
      letterSpacing: 1,
      fontWeight: '700',
    },
    toastOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 58,
      alignItems: 'center',
      zIndex: 100,
    },
  });
}

function TabIcon({ type, active, styles }) {
  const fg = active ? '#ecfeff' : '#8ea7bf';

  if (type === 'board') {
    return (
      <View style={styles.iconWrap}>
        <View style={[styles.iconStroke, { left: 3, bottom: 3, width: 5, height: 11, backgroundColor: fg, borderRadius: 2 }]} />
        <View style={[styles.iconStroke, { left: 9, bottom: 3, width: 5, height: 7, backgroundColor: fg, borderRadius: 2 }]} />
      </View>
    );
  }

  if (type === 'runs') {
    return (
      <View style={styles.iconWrap}>
        <View style={[styles.iconStroke, { width: 14, height: 14, borderRadius: 999, borderWidth: 2, borderColor: fg }]} />
        <View style={[styles.iconStroke, { width: 4, height: 4, borderRadius: 999, backgroundColor: fg }]} />
      </View>
    );
  }

  if (type === 'templates') {
    return (
      <View style={styles.iconWrap}>
        <View style={[styles.iconStroke, { width: 12, height: 14, borderRadius: 2, borderWidth: 2, borderColor: fg }]} />
        <View style={[styles.iconStroke, { width: 6, height: 2, borderRadius: 2, backgroundColor: fg, top: 11 }]} />
      </View>
    );
  }

  if (type === 'audits') {
    return (
      <View style={styles.iconWrap}>
        <View style={[styles.iconStroke, { width: 14, height: 14, borderWidth: 2, borderColor: fg, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 7, borderBottomRightRadius: 7 }]} />
        <View style={[styles.iconStroke, { width: 6, height: 3, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: fg, transform: [{ rotate: '-45deg' }], top: 9 }]} />
      </View>
    );
  }

  return (
    <View style={styles.iconWrap}>
      <View style={[styles.iconStroke, { width: 14, height: 14, borderRadius: 999, borderWidth: 2, borderColor: fg }]} />
      <View style={[styles.iconStroke, { width: 4, height: 4, borderRadius: 999, backgroundColor: fg }]} />
    </View>
  );
}
