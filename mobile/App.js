import React, { useState } from 'react';
import { SafeAreaView } from 'react-native';
import { TamaguiProvider, Tabs, Text, Theme, YStack } from 'tamagui';
import config from './tamagui.config';
import { BoardScreen } from './src/screens/BoardScreen';
import { RunsScreen } from './src/screens/RunsScreen';
import { TemplatesScreen } from './src/screens/TemplatesScreen';
import { AuditsScreen } from './src/screens/AuditsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

export default function App() {
  const [tab, setTab] = useState('board');

  return (
    <TamaguiProvider config={config}>
      <Theme name="dark">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0b1020' }}>
          <YStack f={1}>
            <YStack f={1}>
              {tab === 'board' && <BoardScreen />}
              {tab === 'runs' && <RunsScreen />}
              {tab === 'templates' && <TemplatesScreen />}
              {tab === 'audits' && <AuditsScreen />}
              {tab === 'settings' && <SettingsScreen />}
            </YStack>

            <Tabs value={tab} onValueChange={setTab} orientation="horizontal" flexDirection="column">
              <Tabs.List bg="$secondary" p="$2" jc="space-between">
                <Tabs.Tab value="board" f={1}><Text color="white">Board</Text></Tabs.Tab>
                <Tabs.Tab value="runs" f={1}><Text color="white">Runs</Text></Tabs.Tab>
                <Tabs.Tab value="templates" f={1}><Text color="white">Templates</Text></Tabs.Tab>
                <Tabs.Tab value="audits" f={1}><Text color="white">Audits</Text></Tabs.Tab>
                <Tabs.Tab value="settings" f={1}><Text color="white">Settings</Text></Tabs.Tab>
              </Tabs.List>
            </Tabs>
          </YStack>
        </SafeAreaView>
      </Theme>
    </TamaguiProvider>
  );
}
