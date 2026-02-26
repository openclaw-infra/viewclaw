import { useState, useCallback, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { TamaguiProvider, Theme, YStack } from "tamagui";
import tamaguiConfig from "./tamagui.config";
import { ChatComposer } from "./src/components/chat-composer";
import { ChatHeader } from "./src/components/chat-header";
import { ChatStream } from "./src/components/chat-stream";
import { SessionListSheet } from "./src/components/session-list-sheet";
import { GatewaySheet } from "./src/components/gateway-sheet";
import { AgentSheet } from "./src/components/agent-sheet";
import { SettingsSheet } from "./src/components/settings-sheet";
import { useGatewaySession } from "./src/hooks/use-gateway-session";
import { useGatewayManager } from "./src/hooks/use-gateway-manager";
import { AppThemeProvider, useTheme } from "./src/theme/theme-context";
import type { AgentInfo } from "./src/types/gateway";

function Main() {
  const { isDark, colors } = useTheme();
  const gateway = useGatewayManager();

  const [activeAgentId, setActiveAgentId] = useState("main");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  const session = useGatewaySession({
    agentId: activeAgentId,
    wsUrl: gateway.wsUrl,
    httpUrl: gateway.httpUrl,
  });

  const [sessionSheetVisible, setSessionSheetVisible] = useState(false);
  const [gatewaySheetVisible, setGatewaySheetVisible] = useState(false);
  const [agentSheetVisible, setAgentSheetVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const openSessionSheet = useCallback(() => setSessionSheetVisible(true), []);
  const closeSessionSheet = useCallback(() => setSessionSheetVisible(false), []);
  const openGatewaySheet = useCallback(() => setGatewaySheetVisible(true), []);
  const closeGatewaySheet = useCallback(() => setGatewaySheetVisible(false), []);
  const openAgentSheet = useCallback(() => setAgentSheetVisible(true), []);
  const closeAgentSheet = useCallback(() => setAgentSheetVisible(false), []);
  const openSettings = useCallback(() => setSettingsVisible(true), []);
  const closeSettings = useCallback(() => setSettingsVisible(false), []);

  const fetchAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const res = await fetch(`${gateway.httpUrl}/api/agents`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.agents)) {
        setAgents(data.agents);
      }
    } catch { /* offline */ } finally {
      setAgentsLoading(false);
    }
  }, [gateway.httpUrl]);

  useEffect(() => {
    if (session.connectionStatus === "connected") {
      fetchAgents();
    }
  }, [session.connectionStatus, fetchAgents]);

  const handleAgentSwitch = useCallback((agentId: string) => {
    setActiveAgentId(agentId);
  }, []);

  const themeName = isDark ? "dark" : "light";

  return (
    <Theme name={themeName}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg.primary }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <YStack flex={1} backgroundColor={colors.bg.primary}>
            <ChatHeader
              sessionId={session.currentSessionId}
              status={session.connectionStatus}
              sessionCount={session.sessions.length}
              gatewayLabel={gateway.activeGateway?.label}
              agentId={activeAgentId}
              onSessionPress={openSessionSheet}
              onGatewayPress={openGatewaySheet}
              onAgentPress={openAgentSheet}
              onSettingsPress={openSettings}
            />

            <YStack flex={1}>
              <ChatStream key={session.currentSessionId} stream={session.stream} />
            </YStack>

            <ChatComposer
              sending={session.sending}
              gatewayHttpUrl={session.gatewayHttpUrl}
              onSend={(text, images) => session.sendMessage(text, images)}
            />
          </YStack>
        </KeyboardAvoidingView>

        <SessionListSheet
          visible={sessionSheetVisible}
          sessions={session.sessions}
          currentSessionId={session.currentSessionId}
          onClose={closeSessionSheet}
          onSelect={session.switchSession}
          onCreate={session.createNewSession}
          onRefresh={session.refreshSessions}
        />

        <GatewaySheet
          visible={gatewaySheetVisible}
          gateways={gateway.gateways}
          activeId={gateway.activeId}
          onClose={closeGatewaySheet}
          onSwitch={gateway.switchGateway}
          onAdd={gateway.addGateway}
          onUpdate={gateway.updateGateway}
          onRemove={gateway.removeGateway}
        />

        <AgentSheet
          visible={agentSheetVisible}
          agents={agents}
          activeAgentId={activeAgentId}
          loading={agentsLoading}
          onClose={closeAgentSheet}
          onSelect={handleAgentSwitch}
          onRefresh={fetchAgents}
        />

        <SettingsSheet
          visible={settingsVisible}
          sessions={session.sessions}
          currentSessionId={session.currentSessionId}
          gatewayHttpUrl={session.gatewayHttpUrl}
          onClose={closeSettings}
          onSessionDeleted={session.deleteSession}
          onRefreshSessions={session.refreshSessions}
        />
      </SafeAreaView>
      <StatusBar style={isDark ? "light" : "dark"} />
    </Theme>
  );
}

export default function App() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <AppThemeProvider>
        <Main />
      </AppThemeProvider>
    </TamaguiProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});
