import "./src/i18n";
import { useState, useCallback, useRef, useMemo } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { TamaguiProvider, Theme, YStack } from "tamagui";
import tamaguiConfig from "./tamagui.config";
import { ChatComposer } from "./src/components/chat-composer";
import { ChatHeader } from "./src/components/chat-header";
import { ChatStream } from "./src/components/chat-stream";
import { SessionListSheet } from "./src/components/session-list-sheet";
import { GatewaySheet } from "./src/components/gateway-sheet";
import { ForwardSheet } from "./src/components/forward-sheet";
import { SettingsScreen } from "./src/components/settings-screen";
import { SplashScreen } from "./src/components/splash-screen";
import { useGatewaySession } from "./src/hooks/use-gateway-session";
import { useGatewayManager } from "./src/hooks/use-gateway-manager";
import { useSessionContext } from "./src/hooks/use-session-context";
import { AppThemeProvider, useTheme } from "./src/theme/theme-context";

type Page = "chat" | "settings";

function Main() {
  const { isDark, colors, loaded } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  const onSplashFinish = useCallback(() => setSplashDone(true), []);
  const gateway = useGatewayManager();

  const contextRefreshRef = useRef(() => {});

  const session = useGatewaySession({
    wsUrl: gateway.wsUrl,
    httpUrl: gateway.httpUrl,
    onMessageDone: () => setTimeout(() => contextRefreshRef.current(), 600),
  });

  const sessionContext = useSessionContext({
    sessionId: session.currentSessionId,
    httpUrl: gateway.httpUrl,
  });

  contextRefreshRef.current = sessionContext.refresh;

  const [currentPage, setCurrentPage] = useState<Page>("chat");
  const [sessionSheetVisible, setSessionSheetVisible] = useState(false);
  const [gatewaySheetVisible, setGatewaySheetVisible] = useState(false);
  const [forwardContent, setForwardContent] = useState<string | null>(null);

  const openSessionSheet = useCallback(() => setSessionSheetVisible(true), []);
  const closeSessionSheet = useCallback(() => setSessionSheetVisible(false), []);
  const openGatewaySheet = useCallback(() => setGatewaySheetVisible(true), []);
  const closeGatewaySheet = useCallback(() => setGatewaySheetVisible(false), []);
  const openSettings = useCallback(() => setCurrentPage("settings"), []);
  const closeSettings = useCallback(() => setCurrentPage("chat"), []);

  const handleForwardRequest = useCallback((content: string) => {
    setForwardContent(content);
  }, []);

  const handleForwardSelect = useCallback(
    (targetSessionId: string) => {
      if (forwardContent) {
        session.forwardMessage(targetSessionId, forwardContent);
      }
      setForwardContent(null);
    },
    [forwardContent, session],
  );

  const closeForwardSheet = useCallback(() => setForwardContent(null), []);

  const currentSessionTitle = useMemo(
    () => session.sessions.find((s) => s.id === session.currentSessionId)?.title,
    [session.sessions, session.currentSessionId],
  );

  const themeName = isDark ? "dark" : "light";

  return (
    <Theme name={themeName}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg.primary }]}>
        {currentPage === "settings" ? (
          <SettingsScreen
            sessions={session.sessions}
            currentSessionId={session.currentSessionId}
            gatewayHttpUrl={session.gatewayHttpUrl}
            onBack={closeSettings}
            onSessionDeleted={session.deleteSession}
            onRefreshSessions={session.refreshSessions}
          />
        ) : (
          <>
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={0}
            >
              <YStack flex={1} backgroundColor={colors.bg.primary}>
                <ChatHeader
                  sessionId={session.currentSessionId}
                  sessionTitle={currentSessionTitle}
                  status={session.connectionStatus}
                  sessionCount={session.sessions.length}
                  gatewayLabel={gateway.activeGateway?.label}
                  context={sessionContext.context}
                  onSessionPress={openSessionSheet}
                  onGatewayPress={openGatewaySheet}
                  onSettingsPress={openSettings}
                />

                <YStack flex={1}>
                  <ChatStream
                    key={session.currentSessionId}
                    stream={session.stream}
                    onForward={handleForwardRequest}
                  />
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

            <ForwardSheet
              visible={forwardContent !== null}
              sessions={session.sessions}
              currentSessionId={session.currentSessionId}
              messagePreview={forwardContent ?? ""}
              onClose={closeForwardSheet}
              onSelect={handleForwardSelect}
            />
          </>
        )}
      </SafeAreaView>
      <StatusBar style={isDark ? "light" : "dark"} />
      {!splashDone && (
        <SplashScreen ready={loaded} onFinish={onSplashFinish} />
      )}
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
