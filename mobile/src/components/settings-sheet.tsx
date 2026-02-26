import { memo, useCallback, useState } from "react";
import { Pressable, Modal, ScrollView, Alert } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useTheme } from "../theme/theme-context";
import type { ThemeMode } from "../theme/colors";
import type { SessionInfo } from "../types/gateway";

type Props = {
  visible: boolean;
  sessions: SessionInfo[];
  currentSessionId: string;
  gatewayHttpUrl: string;
  onClose: () => void;
  onSessionDeleted: (sessionId: string) => void;
  onRefreshSessions: () => Promise<void>;
};

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: "light", label: "Light", icon: "☀️" },
  { mode: "dark", label: "Dark", icon: "🌙" },
  { mode: "system", label: "System", icon: "⚙️" },
];

const SectionHeader = memo(({ title }: { title: string }) => {
  const { colors } = useTheme();
  return (
    <Text
      color={colors.text.muted}
      fontSize={12}
      fontWeight="600"
      textTransform="uppercase"
      letterSpacing={0.8}
      paddingHorizontal="$4"
      paddingTop="$4"
      paddingBottom="$2"
    >
      {title}
    </Text>
  );
});

const SettingRow = memo(
  ({
    label,
    value,
    onPress,
    danger,
  }: {
    label: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
  }) => {
    const { colors } = useTheme();
    return (
      <Pressable onPress={onPress} disabled={!onPress}>
        {({ pressed }) => (
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3.5"
            alignItems="center"
            justifyContent="space-between"
            backgroundColor={pressed ? colors.bg.tertiary : "transparent"}
          >
            <Text
              color={danger ? colors.accent.red : colors.text.primary}
              fontSize={15}
            >
              {label}
            </Text>
            {value && (
              <Text color={colors.text.muted} fontSize={14}>
                {value}
              </Text>
            )}
          </XStack>
        )}
      </Pressable>
    );
  },
);

export const SettingsSheet = memo(
  ({
    visible,
    sessions,
    currentSessionId,
    gatewayHttpUrl,
    onClose,
    onSessionDeleted,
    onRefreshSessions,
  }: Props) => {
    const { mode, colors, setMode } = useTheme();
    const [deleting, setDeleting] = useState<string | null>(null);

    const handleDeleteSession = useCallback(
      (sessionId: string) => {
        const isCurrent = sessionId === currentSessionId;
        Alert.alert(
          "Delete Session",
          isCurrent
            ? "This is the active session. Delete it?"
            : "Delete this session and its history?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                setDeleting(sessionId);
                try {
                  await fetch(`${gatewayHttpUrl}/api/sessions/${sessionId}`, {
                    method: "DELETE",
                  });
                  onSessionDeleted(sessionId);
                  await onRefreshSessions();
                } catch { /* offline */ } finally {
                  setDeleting(null);
                }
              },
            },
          ],
        );
      },
      [currentSessionId, gatewayHttpUrl, onSessionDeleted, onRefreshSessions],
    );

    const handleClearAll = useCallback(() => {
      Alert.alert(
        "Clear All Sessions",
        `Delete all ${sessions.length} sessions? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete All",
            style: "destructive",
            onPress: async () => {
              setDeleting("all");
              try {
                await Promise.all(
                  sessions.map((s) =>
                    fetch(`${gatewayHttpUrl}/api/sessions/${s.id}`, {
                      method: "DELETE",
                    }).catch(() => {}),
                  ),
                );
                for (const s of sessions) onSessionDeleted(s.id);
                await onRefreshSessions();
              } finally {
                setDeleting(null);
              }
            },
          },
        ],
      );
    }, [sessions, gatewayHttpUrl, onSessionDeleted, onRefreshSessions]);

    const formatDate = (iso: string) => {
      if (!iso) return "";
      const d = new Date(iso);
      return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={onClose}
        >
          <Pressable
            style={{ flex: 1, marginTop: 60 }}
            onPress={(e) => e.stopPropagation?.()}
          >
            <YStack
              flex={1}
              backgroundColor={colors.bg.secondary}
              borderTopLeftRadius={20}
              borderTopRightRadius={20}
              overflow="hidden"
            >
              {/* Handle bar */}
              <YStack alignItems="center" paddingVertical="$2">
                <YStack
                  width={36}
                  height={4}
                  borderRadius={2}
                  backgroundColor={colors.border.medium}
                />
              </YStack>

              {/* Header */}
              <XStack
                alignItems="center"
                justifyContent="space-between"
                paddingHorizontal="$4"
                paddingVertical="$2.5"
              >
                <Text
                  color={colors.text.primary}
                  fontSize={20}
                  fontWeight="700"
                >
                  Settings
                </Text>
                <Pressable onPress={onClose}>
                  <YStack
                    paddingHorizontal="$2.5"
                    paddingVertical="$1.5"
                    borderRadius={8}
                    backgroundColor={colors.bg.elevated}
                  >
                    <Text color={colors.text.secondary} fontSize={12} fontWeight="600">
                      Done
                    </Text>
                  </YStack>
                </Pressable>
              </XStack>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Theme */}
                <SectionHeader title="Appearance" />
                <XStack paddingHorizontal="$4" gap="$2">
                  {THEME_OPTIONS.map((opt) => {
                    const active = mode === opt.mode;
                    return (
                      <Pressable
                        key={opt.mode}
                        onPress={() => setMode(opt.mode)}
                        style={{ flex: 1 }}
                      >
                        <YStack
                          alignItems="center"
                          paddingVertical="$3"
                          borderRadius={12}
                          borderWidth={2}
                          borderColor={active ? colors.accent.blue : colors.border.subtle}
                          backgroundColor={active ? colors.accent.blue + "12" : colors.bg.tertiary}
                          gap="$1.5"
                        >
                          <Text fontSize={22}>{opt.icon}</Text>
                          <Text
                            color={active ? colors.accent.blue : colors.text.secondary}
                            fontSize={13}
                            fontWeight={active ? "700" : "500"}
                          >
                            {opt.label}
                          </Text>
                        </YStack>
                      </Pressable>
                    );
                  })}
                </XStack>

                {/* Session management */}
                <SectionHeader title="Sessions" />
                <SettingRow
                  label="Total sessions"
                  value={String(sessions.length)}
                />

                {sessions.length > 0 && (
                  <>
                    <YStack
                      marginHorizontal="$4"
                      borderRadius={12}
                      backgroundColor={colors.bg.tertiary}
                      overflow="hidden"
                      marginTop="$1"
                    >
                      {sessions.slice(0, 10).map((s, i) => {
                        const isCurrent = s.id === currentSessionId;
                        const isDeleting = deleting === s.id || deleting === "all";
                        return (
                          <XStack
                            key={s.id}
                            paddingHorizontal="$3"
                            paddingVertical="$2.5"
                            alignItems="center"
                            justifyContent="space-between"
                            borderTopWidth={i > 0 ? 1 : 0}
                            borderColor={colors.border.subtle}
                          >
                            <YStack flex={1} gap="$0.5" marginRight="$2">
                              <XStack alignItems="center" gap="$1.5">
                                {isCurrent && (
                                  <YStack
                                    backgroundColor={colors.accent.blue}
                                    paddingHorizontal={5}
                                    paddingVertical={1}
                                    borderRadius={3}
                                    flexShrink={0}
                                  >
                                    <Text color="#FFF" fontSize={8} fontWeight="700">
                                      ACTIVE
                                    </Text>
                                  </YStack>
                                )}
                                <Text
                                  color={isCurrent ? colors.accent.blue : colors.text.primary}
                                  fontSize={13}
                                  numberOfLines={1}
                                  flexShrink={1}
                                >
                                  {s.title ?? s.id.slice(0, 8)}
                                </Text>
                              </XStack>
                              <Text color={colors.text.muted} fontSize={11}>
                                {formatDate(s.createdAt)}
                              </Text>
                            </YStack>
                            <Pressable
                              onPress={() => handleDeleteSession(s.id)}
                              disabled={isDeleting}
                              hitSlop={8}
                            >
                              <YStack
                                paddingHorizontal="$2"
                                paddingVertical="$1"
                                borderRadius={6}
                                backgroundColor={colors.bg.elevated}
                              >
                                <Text
                                  color={isDeleting ? colors.text.muted : colors.accent.red}
                                  fontSize={11}
                                  fontWeight="600"
                                >
                                  {isDeleting ? "..." : "Delete"}
                                </Text>
                              </YStack>
                            </Pressable>
                          </XStack>
                        );
                      })}
                    </YStack>

                    {sessions.length > 1 && (
                      <YStack paddingHorizontal="$4" paddingTop="$3">
                        <Pressable onPress={handleClearAll} disabled={!!deleting}>
                          <YStack
                            alignItems="center"
                            paddingVertical="$2.5"
                            borderRadius={10}
                            backgroundColor={colors.accent.red + "12"}
                            borderWidth={1}
                            borderColor={colors.accent.red + "30"}
                          >
                            <Text
                              color={deleting ? colors.text.muted : colors.accent.red}
                              fontSize={14}
                              fontWeight="600"
                            >
                              {deleting === "all" ? "Deleting..." : "Delete All Sessions"}
                            </Text>
                          </YStack>
                        </Pressable>
                      </YStack>
                    )}
                  </>
                )}

                {/* About */}
                <SectionHeader title="About" />
                <SettingRow label="App" value="ViewClaw" />
                <SettingRow label="Version" value="2.0.0" />

                <YStack height={60} />
              </ScrollView>
            </YStack>
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);
