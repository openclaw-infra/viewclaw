import { useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { TamaguiProvider, Theme, YStack } from "tamagui";
import tamaguiConfig from "./tamagui.config";
import { ChatComposer } from "./src/components/chat-composer";
import { ChatHeader } from "./src/components/chat-header";
import { ChatStream } from "./src/components/chat-stream";
import { SessionListSheet } from "./src/components/session-list-sheet";
import { GatewaySheet } from "./src/components/gateway-sheet";
import { useGatewaySession } from "./src/hooks/use-gateway-session";
import { useGatewayManager } from "./src/hooks/use-gateway-manager";

export default function App() {
  const gateway = useGatewayManager();
  const session = useGatewaySession({
    agentId: "main",
    wsUrl: gateway.wsUrl,
    httpUrl: gateway.httpUrl,
  });

  const [sessionSheetVisible, setSessionSheetVisible] = useState(false);
  const [gatewaySheetVisible, setGatewaySheetVisible] = useState(false);

  const openSessionSheet = useCallback(() => setSessionSheetVisible(true), []);
  const closeSessionSheet = useCallback(() => setSessionSheetVisible(false), []);
  const openGatewaySheet = useCallback(() => setGatewaySheetVisible(true), []);
  const closeGatewaySheet = useCallback(() => setGatewaySheetVisible(false), []);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <Theme name="dark">
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            <YStack flex={1} backgroundColor="#000000">
              <ChatHeader
                sessionId={session.currentSessionId}
                status={session.connectionStatus}
                sessionCount={session.sessions.length}
                gatewayLabel={gateway.activeGateway?.label}
                onSessionPress={openSessionSheet}
                onGatewayPress={openGatewaySheet}
              />

              <YStack flex={1}>
                <ChatStream stream={session.stream} />
              </YStack>

              <ChatComposer
                sending={session.sending}
                gatewayHttpUrl={session.gatewayHttpUrl}
                onSend={session.sendMessage}
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
        </SafeAreaView>
        <StatusBar style="light" />
      </Theme>
    </TamaguiProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000000",
  },
  flex: {
    flex: 1,
  },
});
