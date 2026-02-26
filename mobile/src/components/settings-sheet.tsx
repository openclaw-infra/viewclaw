import { memo, useCallback, useState } from "react";
import { Pressable, Modal, ScrollView, Alert, View, StyleSheet, Image } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useTheme } from "../theme/theme-context";
import type { ThemeMode } from "../theme/colors";
import type { SessionInfo } from "../types/gateway";

const logoIcon = require("../../assets/logo-icon.png");

type Props = {
  visible: boolean;
  sessions: SessionInfo[];
  currentSessionId: string;
  gatewayHttpUrl: string;
  onClose: () => void;
  onSessionDeleted: (sessionId: string) => void;
  onRefreshSessions: () => Promise<void>;
};

const SunIcon = ({ color, size = 22, bgColor }: { color: string; size?: number; bgColor?: string }) => (
  <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const cx = size / 2;
      return (
        <View
          key={deg}
          style={{
            position: "absolute",
            width: 3.5,
            height: 1.5,
            borderRadius: 0.75,
            backgroundColor: color,
            left: cx - 1.75 + Math.cos(rad) * 7,
            top: cx - 0.75 + Math.sin(rad) * 7,
            transform: [{ rotate: `${deg}deg` }],
          }}
        />
      );
    })}
  </View>
);

const MoonIcon = ({ color, size = 22, bgColor }: { color: string; size?: number; bgColor?: string }) => (
  <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color }} />
    <View
      style={{
        position: "absolute",
        width: 11,
        height: 11,
        borderRadius: 5.5,
        backgroundColor: bgColor || "#272A30",
        top: 1,
        right: 2,
      }}
    />
  </View>
);

const MonitorIcon = ({ color, size = 22 }: { color: string; size?: number; bgColor?: string }) => (
  <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <View style={{ width: 14, height: 10, borderWidth: 1.5, borderColor: color, borderRadius: 2.5 }} />
    <View style={{ width: 7, height: 1.5, backgroundColor: color, borderRadius: 1, marginTop: 1.5 }} />
  </View>
);

type ThemeOptionType = { mode: ThemeMode; label: string; Icon: React.FC<{ color: string; size?: number; bgColor?: string }> };
const THEME_OPTIONS: ThemeOptionType[] = [
  { mode: "light", label: "Light", Icon: SunIcon },
  { mode: "dark", label: "Dark", Icon: MoonIcon },
  { mode: "system", label: "System", Icon: MonitorIcon },
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
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
          onPress={onClose}
        >
          <Pressable
            style={{ flex: 1, marginTop: 60 }}
            onPress={(e) => e.stopPropagation?.()}
          >
            <YStack
              flex={1}
              backgroundColor={colors.bg.secondary}
              borderTopLeftRadius={24}
              borderTopRightRadius={24}
              overflow="hidden"
            >
              <YStack alignItems="center" paddingVertical={10}>
                <YStack
                  width={40}
                  height={4}
                  borderRadius={2}
                  backgroundColor={colors.border.medium}
                  opacity={0.6}
                />
              </YStack>

              <XStack
                alignItems="center"
                justifyContent="space-between"
                paddingHorizontal={16}
                paddingVertical={10}
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
                    paddingHorizontal={12}
                    paddingVertical={6}
                    borderRadius={12}
                    backgroundColor={colors.bg.tertiary}
                    borderWidth={1}
                    borderColor={colors.border.subtle}
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
                <XStack paddingHorizontal={16} gap={8}>
                  {THEME_OPTIONS.map((opt) => {
                    const active = mode === opt.mode;
                    const cardBg = active ? colors.brand.blue + "12" : colors.bg.tertiary;
                    return (
                      <Pressable
                        key={opt.mode}
                        onPress={() => setMode(opt.mode)}
                        style={{ flex: 1 }}
                      >
                        <YStack
                          alignItems="center"
                          paddingVertical={12}
                          borderRadius={12}
                          borderWidth={2}
                          borderColor={active ? colors.brand.blue : colors.border.subtle}
                          backgroundColor={cardBg}
                          gap={6}
                        >
                          <opt.Icon color={active ? colors.brand.blue : colors.text.muted} size={22} bgColor={cardBg} />
                          <Text
                            color={active ? colors.brand.blue : colors.text.secondary}
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
                                    backgroundColor={colors.brand.blue}
                                    paddingHorizontal={6}
                                    paddingVertical={2}
                                    borderRadius={6}
                                    flexShrink={0}
                                  >
                                    <Text color="#FFF" fontSize={8} fontWeight="700" letterSpacing={0.5}>
                                      ACTIVE
                                    </Text>
                                  </YStack>
                                )}
                                <Text
                                  color={isCurrent ? colors.brand.blue : colors.text.primary}
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
                <YStack alignItems="center" paddingVertical={16} gap={8}>
                  <Image source={logoIcon} style={{ width: 48, height: 48 }} resizeMode="contain" />
                  <Text color={colors.text.primary} fontSize={16} fontWeight="700">
                    ClawFlow
                  </Text>
                  <Text color={colors.text.muted} fontSize={12}>
                    Version 2.0.0
                  </Text>
                </YStack>

                <YStack height={60} />
              </ScrollView>
            </YStack>
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);
