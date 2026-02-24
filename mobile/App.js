import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Tabs, Text, Theme, YStack, XStack } from 'tamagui';
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
        <YStack ai="center" jc="center" gap="$1" py="$2" opacity={isActive ? 1 : 0.4}>
          <Ionicons 
            name={isActive ? icon.replace('-outline', '') : icon} 
            size={22} 
            color={isActive ? '#1677ff' : '#8c8c8c'} 
          />
          <Text 
            fontSize={10} 
            color={isActive ? '$primary' : '$textMuted'} 
            fontWeight={isActive ? '600' : '400'}
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
              borderTopWidth={0.5}
              borderColor="$border"
              paddingBottom={20} // Safe area adjustment
            >
              <Tabs.List bg="transparent" jc="space-around" px="$2">
                <TabItem value="board" label="Tasks" icon="grid-outline" />
                <TabItem value="runs" label="Runs" icon="pulse-outline" />
                <TabItem value="templates" label="Design" icon="layers-outline" />
                <TabItem value="audits" label="Audit" icon="shield-checkmark-outline" />
                <TabItem value="settings" label="Config" icon="options-outline" />
              </Tabs.List>
            </Tabs>
          </YStack>
        </Theme>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
