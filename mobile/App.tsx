import "./src/i18n";
import { useState, useCallback, useRef, useMemo } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, PanResponder, View } from "react-native";
import { KeyboardProvider, KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();
  const [splashDone, setSplashDone] = useState(false);
  const onSplashFinish = useCallback(() => setSplashDone(true), []);
  const gateway = useGatewayManager();

  const contextRefreshRef = useRef(() => {});

  const session = useGatewaySession({
    wsUrl: gateway.wsUrl,
    httpUrl: gateway.httpUrl,
    onMessageDone: () => setTimeout(() => contextRefreshRef.current(), 600),
  });

  const currentSession = useMemo(
    () => session.sessions.find((s) => s.id === session.currentSessionId),
    [session.sessions, session.currentSessionId],
  );
  const currentSessionTitle = currentSession?.title;
  const currentAgentId = currentSession?.agentId ?? "main";

  const sessionContext = useSessionContext({
    sessionId: session.currentSessionId,
    httpUrl: gateway.httpUrl,
    agentId: currentAgentId,
  });

  contextRefreshRef.current = sessionContext.refresh;

  const [currentPage, setCurrentPage] = useState<Page>("chat");
  const [sessionSheetVisible, setSessionSheetVisible] = useState(false);
  const [gatewaySheetVisible, setGatewaySheetVisible] = useState(false);
  const [forwardContent, setForwardContent] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<string | null>(null);

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

  const handleReplyRequest = useCallback((content: string) => {
    setReplyContent(content);
  }, []);

  const clearReply = useCallback(() => setReplyContent(null), []);

  const themeName = isDark ? "dark" : "light";

  const SWIPE_MIN = 50;

  const swipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_MIN) {
          setSessionSheetVisible(true);
        } else if (g.dx < -SWIPE_MIN) {
          setGatewaySheetVisible(true);
        }
      },
    }),
  ).current;

  return (
    <Theme name={themeName}>
      <View style={[styles.safe, { backgroundColor: colors.bg.primary, paddingTop: insets.top }]}>
        <View style={styles.flex} {...swipePanResponder.panHandlers}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior="padding"
            keyboardVerticalOffset={insets.top - insets.bottom}
          >
            <YStack flex={1} backgroundColor={colors.bg.primary}>
              <ChatHeader
                sessionId={session.currentSessionId}
                sessionTitle={currentSessionTitle}
                agentId={currentAgentId}
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
                  onReply={handleReplyRequest}
                />
              </YStack>

              <ChatComposer
                sending={session.sending}
                gatewayHttpUrl={session.gatewayHttpUrl}
                replyContent={replyContent}
                onClearReply={clearReply}
                onSend={(text, images) => session.sendMessage(text, images)}
              />
            </YStack>
          </KeyboardAvoidingView>
        </View>

        <SessionListSheet
          visible={sessionSheetVisible}
          sessions={session.sessions}
          agents={session.agents}
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

        {currentPage === "settings" && (
          <View style={[StyleSheet.absoluteFill, { top: insets.top, paddingBottom: insets.bottom }]}>
            <SettingsScreen
              sessions={session.sessions}
              currentSessionId={session.currentSessionId}
              gatewayHttpUrl={session.gatewayHttpUrl}
              onBack={closeSettings}
              onSessionDeleted={session.deleteSession}
              onRefreshSessions={session.refreshSessions}
            />
          </View>
        )}
      </View>
      <StatusBar style={isDark ? "light" : "dark"} />
      {!splashDone && (
        <SplashScreen ready={loaded} onFinish={onSplashFinish} />
      )}
    </Theme>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <AppThemeProvider>
            <Main />
          </AppThemeProvider>
        </TamaguiProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
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
