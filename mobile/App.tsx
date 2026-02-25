import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { TamaguiProvider, Theme, YStack } from "tamagui";
import tamaguiConfig from "./tamagui.config";
import { ChatComposer } from "./src/components/chat-composer";
import { ChatHeader } from "./src/components/chat-header";
import { ChatStream } from "./src/components/chat-stream";
import { useGatewaySession } from "./src/hooks/use-gateway-session";

export default function App() {
  const session = useGatewaySession({ agentId: "main" });

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
