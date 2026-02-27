import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Alert, View, Image, Animated, Easing, Dimensions } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Sun, Moon, Monitor, Globe } from "@tamagui/lucide-icons";
import { useTheme } from "../theme/theme-context";
import type { ThemeMode } from "../theme/colors";
import type { SessionInfo } from "../types/gateway";
import { changeLanguage, getCurrentLanguagePref } from "../i18n";
import type { AppLanguage } from "../data/settings-storage";

const logoIcon = require("../../assets/logo-icon.png");
const SCREEN_WIDTH = Dimensions.get("window").width;

type Props = {
  sessions: SessionInfo[];
  currentSessionId: string;
  gatewayHttpUrl: string;
  onBack: () => void;
  onSessionDeleted: (sessionId: string) => void;
  onRefreshSessions: () => Promise<void>;
};

type IconComponent = React.FC<{ color: string; size?: number }>;

type ThemeOptionType = { mode: ThemeMode; labelKey: string; Icon: IconComponent };
const THEME_OPTIONS: ThemeOptionType[] = [
  { mode: "light", labelKey: "settings.light", Icon: Sun },
  { mode: "dark", labelKey: "settings.dark", Icon: Moon },
  { mode: "system", labelKey: "settings.system", Icon: Monitor },
];

type LangOptionType = { lang: AppLanguage; labelKey: string; Icon: IconComponent };
const LANG_OPTIONS: LangOptionType[] = [
  { lang: "en", labelKey: "settings.english", Icon: Globe },
  { lang: "zh", labelKey: "settings.chinese", Icon: Globe },
  { lang: "system", labelKey: "settings.system", Icon: Monitor },
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
      paddingHorizontal={16}
      paddingTop={24}
      paddingBottom={8}
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
            paddingHorizontal={16}
            paddingVertical={14}
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

export const SettingsScreen = memo(
  ({
    sessions,
    currentSessionId,
    gatewayHttpUrl,
    onBack,
    onSessionDeleted,
    onRefreshSessions,
  }: Props) => {
    const { mode, colors, setMode } = useTheme();
    const { t } = useTranslation();
    const [deleting, setDeleting] = useState<string | null>(null);
    const [langPref, setLangPref] = useState<AppLanguage>(getCurrentLanguagePref);
    const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

    useEffect(() => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, [slideAnim]);

    const handleBack = useCallback(() => {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onBack());
    }, [slideAnim, onBack]);

    const handleDeleteSession = useCallback(
      (sessionId: string) => {
        const isCurrent = sessionId === currentSessionId;
        Alert.alert(
          t("settings.deleteSession"),
          isCurrent
            ? t("settings.deleteActiveSessionConfirm")
            : t("settings.deleteSessionConfirm"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("common.delete"),
              style: "destructive",
              onPress: async () => {
                setDeleting(sessionId);
                try {
                  if (!sessionId.startsWith("pending-")) {
                    await fetch(`${gatewayHttpUrl}/api/sessions/${sessionId}`, {
                      method: "DELETE",
                    });
                  }
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
        t("settings.clearAllSessions"),
        t("settings.clearAllConfirm", { count: sessions.length }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("settings.deleteAll"),
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
      <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
        <YStack flex={1} backgroundColor={colors.bg.primary}>
          {/* Navigation header */}
          <XStack
            alignItems="center"
            paddingHorizontal={16}
            paddingVertical={12}
            borderBottomWidth={1}
            borderColor={colors.border.subtle}
            gap={12}
          >
            <Pressable onPress={handleBack} hitSlop={12}>
              <YStack
                width={36}
                height={36}
                borderRadius={18}
                backgroundColor={colors.bg.tertiary}
                alignItems="center"
                justifyContent="center"
              >
                <ArrowLeft size={20} color={colors.text.primary} />
              </YStack>
            </Pressable>
            <Text
              color={colors.text.primary}
              fontSize={20}
              fontWeight="700"
              flex={1}
            >
              {t("settings.title")}
            </Text>
          </XStack>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Theme */}
            <SectionHeader title={t("settings.appearance")} />
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
                      <opt.Icon color={active ? colors.brand.blue : colors.text.muted} size={22} />
                      <Text
                        color={active ? colors.brand.blue : colors.text.secondary}
                        fontSize={13}
                        fontWeight={active ? "700" : "500"}
                      >
                        {t(opt.labelKey)}
                      </Text>
                    </YStack>
                  </Pressable>
                );
              })}
            </XStack>

            {/* Language */}
            <SectionHeader title={t("settings.language")} />
            <XStack paddingHorizontal={16} gap={8}>
              {LANG_OPTIONS.map((opt) => {
                const active = langPref === opt.lang;
                const cardBg = active ? colors.brand.purple + "12" : colors.bg.tertiary;
                return (
                  <Pressable
                    key={opt.lang}
                    onPress={() => {
                      setLangPref(opt.lang);
                      changeLanguage(opt.lang);
                    }}
                    style={{ flex: 1 }}
                  >
                    <YStack
                      alignItems="center"
                      paddingVertical={12}
                      borderRadius={12}
                      borderWidth={2}
                      borderColor={active ? colors.brand.purple : colors.border.subtle}
                      backgroundColor={cardBg}
                      gap={6}
                    >
                      <opt.Icon color={active ? colors.brand.purple : colors.text.muted} size={22} />
                      <Text
                        color={active ? colors.brand.purple : colors.text.secondary}
                        fontSize={13}
                        fontWeight={active ? "700" : "500"}
                      >
                        {t(opt.labelKey)}
                      </Text>
                    </YStack>
                  </Pressable>
                );
              })}
            </XStack>

            {/* Session management */}
            <SectionHeader title={t("settings.sessions")} />
            <SettingRow
              label={t("settings.totalSessions")}
              value={String(sessions.length)}
            />

            {sessions.length > 0 && (
              <>
                <YStack
                  marginHorizontal={16}
                  borderRadius={12}
                  backgroundColor={colors.bg.secondary}
                  overflow="hidden"
                  marginTop={4}
                >
                  {sessions.slice(0, 10).map((s, i) => {
                    const isCurrent = s.id === currentSessionId;
                    const isDeleting = deleting === s.id || deleting === "all";
                    return (
                      <XStack
                        key={s.id}
                        paddingHorizontal={12}
                        paddingVertical={10}
                        alignItems="center"
                        justifyContent="space-between"
                        borderTopWidth={i > 0 ? 1 : 0}
                        borderColor={colors.border.subtle}
                      >
                        <YStack flex={1} gap={2} marginRight={8}>
                          <XStack alignItems="center" gap={6}>
                            {isCurrent && (
                              <YStack
                                backgroundColor={colors.brand.blue}
                                paddingHorizontal={6}
                                paddingVertical={2}
                                borderRadius={6}
                                flexShrink={0}
                              >
                                <Text color="#FFF" fontSize={8} fontWeight="700" letterSpacing={0.5}>
                                  {t("common.active")}
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
                            paddingHorizontal={8}
                            paddingVertical={4}
                            borderRadius={6}
                            backgroundColor={colors.bg.elevated}
                          >
                            <Text
                              color={isDeleting ? colors.text.muted : colors.accent.red}
                              fontSize={11}
                              fontWeight="600"
                            >
                              {isDeleting ? "..." : t("common.delete")}
                            </Text>
                          </YStack>
                        </Pressable>
                      </XStack>
                    );
                  })}
                </YStack>

                {sessions.length > 1 && (
                  <YStack paddingHorizontal={16} paddingTop={12}>
                    <Pressable onPress={handleClearAll} disabled={!!deleting}>
                      <YStack
                        alignItems="center"
                        paddingVertical={10}
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
                          {deleting === "all" ? t("common.deleting") : t("settings.deleteAllSessions")}
                        </Text>
                      </YStack>
                    </Pressable>
                  </YStack>
                )}
              </>
            )}

            {/* About */}
            <SectionHeader title={t("settings.about")} />
            <YStack alignItems="center" paddingVertical={24} gap={8}>
              <Image source={logoIcon} style={{ width: 56, height: 56 }} resizeMode="contain" />
              <Text color={colors.text.primary} fontSize={18} fontWeight="700">
                ClawFlow
              </Text>
              <Text color={colors.text.muted} fontSize={12}>
                {t("common.version", { version: "2.0.0" })}
              </Text>
            </YStack>

            <YStack height={60} />
          </ScrollView>
        </YStack>
      </Animated.View>
    );
  },
);
