import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Tabs, Text, Theme, YStack, XStack } from 'tamagui';
import { LayoutDashboard, Activity, FileCode, ShieldAlert, Settings } from 'lucide-react-native';
import config from './tamagui.config';
import { BoardScreen } from './src/screens/BoardScreen';
import { RunsScreen } from './src/screens/RunsScreen';
import { TemplatesScreen } from './src/screens/TemplatesScreen';
import { AuditsScreen } from './src/screens/AuditsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

export default function App() {
  const [tab, setTab] = useState('board');

  const TabItem = ({ value, label, Icon }) => {
    const isActive = tab === value;
    return (
      <Tabs.Tab 
        value={value} 
        f={1} 
        unstyled 
        onInteraction={() => setTab(value)}
      >
        <YStack ai="center" jc="center" gap="$1" py="$3" opacity={isActive ? 1 : 0.5}>
          <Icon size={20} color={isActive ? '#6366f1' : '#a1a1aa'} />
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
                <TabItem value="board" label="Board" Icon={LayoutDashboard} />
                <TabItem value="runs" label="Runs" Icon={Activity} />
                <TabItem value="templates" label="Templates" Icon={FileCode} />
                <TabItem value="audits" label="Audits" Icon={ShieldAlert} />
                <TabItem value="settings" label="Settings" Icon={Settings} />
              </Tabs.List>
            </Tabs>
          </YStack>
        </Theme>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
