import { useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { TamaguiProvider, Theme, YStack } from "tamagui";
import tamaguiConfig from "./tamagui.config";
import { ChatComposer } from "./src/components/chat-composer";
import { ChatHeader } from "./src/components/chat-header";
import { ChatStream } from "./src/components/chat-stream";
import { SessionListSheet } from "./src/components/session-list-sheet";
import { useGatewaySession } from "./src/hooks/use-gateway-session";

export default function App() {
  const session = useGatewaySession({ agentId: "main" });
  const [sessionSheetVisible, setSessionSheetVisible] = useState(false);

  const openSessionSheet = useCallback(() => setSessionSheetVisible(true), []);
  const closeSessionSheet = useCallback(() => setSessionSheetVisible(false), []);

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
                onSessionPress={openSessionSheet}
              />

              <YStack flex={1}>
                <ChatStream stream={session.stream} />
              </YStack>

              <ChatComposer
                sending={session.sending}
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
