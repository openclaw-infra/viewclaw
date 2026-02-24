import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Tabs, Text, Theme, YStack } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';
import config from './tamagui.config';
import { BoardScreen } from './src/screens/BoardScreen';
import { RunsScreen } from './src/screens/RunsScreen';
import { TemplatesScreen } from './src/screens/TemplatesScreen';
import { AuditsScreen } from './src/screens/AuditsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

export default function App() {
  const [tab, setTab] = useState('board');

  const TabItem = ({ value, label, icon }) => {
    const isActive = tab === value;
    return (
      <Tabs.Tab 
        value={value} 
        f={1} 
        unstyled 
        onInteraction={() => setTab(value)}
      >
        <YStack ai="center" jc="center" gap="$1" py="$3" opacity={isActive ? 1 : 0.5}>
          <Ionicons name={icon} size={20} color={isActive ? '#6366f1' : '#a1a1aa'} />
          <Text 
            fontSize={10} 
            color={isActive ? '$primary' : '$textMuted'} 
            fontWeight={isActive ? '700' : '500'}
          >
            {label}
          </Text>
        </YStack>
      </Tabs.Tab>
    );
  };

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config}>
        <Theme name="dark">
          <YStack f={1} bg="$background">
            <YStack f={1}>
              {tab === 'board' && <BoardScreen />}
              {tab === 'runs' && <RunsScreen />}
              {tab === 'templates' && <TemplatesScreen />}
              {tab === 'audits' && <AuditsScreen />}
              {tab === 'settings' && <SettingsScreen />}
            </YStack>

            <Tabs 
              value={tab} 
              onValueChange={setTab} 
              orientation="horizontal" 
              flexDirection="column"
              bg="$card"
              borderTopWidth={1}
              borderColor="$border"
              pb="$4" // Extra padding for safe area
            >
              <Tabs.List bg="transparent" jc="space-around">
                <TabItem value="board" label="Board" icon="grid-outline" />
                <TabItem value="runs" label="Runs" icon="pulse-outline" />
                <TabItem value="templates" label="Templates" icon="document-text-outline" />
                <TabItem value="audits" label="Audits" icon="shield-checkmark-outline" />
                <TabItem value="settings" label="Settings" icon="settings-outline" />
              </Tabs.List>
            </Tabs>
          </YStack>
        </Theme>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
