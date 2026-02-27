import { memo, useCallback, useState, useRef, useEffect } from "react";
import { FlatList, Pressable, Modal, StyleSheet, Animated, Dimensions, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/theme-context";
import type { SessionInfo } from "../types/gateway";

type Props = {
  visible: boolean;
  sessions: SessionInfo[];
  currentSessionId: string;
  onClose: () => void;
  onSelect: (sessionId: string) => void;
  onCreate: () => Promise<string | null>;
  onRefresh: () => Promise<void>;
};

const formatDate = (iso: string, yesterdayLabel: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) {
    return yesterdayLabel + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const SessionRow = memo(
  ({
    item,
    isCurrent,
    onSelect,
  }: {
    item: SessionInfo;
    isCurrent: boolean;
    onSelect: (id: string) => void;
  }) => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const shortId = item.id.slice(0, 8);
    const displayTitle = item.title ?? (item.sessionKey
      ? item.sessionKey.replace(/^agent:\w+:/, "").replace(/^openresponses:/, "").slice(0, 20)
      : shortId);

    return (
      <Pressable onPress={() => onSelect(item.id)}>
        {({ pressed }) => (
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            gap="$3"
            alignItems="center"
            backgroundColor={
              isCurrent
                ? colors.bg.elevated
                : pressed
                  ? colors.bg.tertiary
                  : "transparent"
            }
            borderLeftWidth={isCurrent ? 3 : 0}
            borderLeftColor={isCurrent ? colors.brand.blue : "transparent"}
          >
            <YStack flex={1} gap="$1">
              <XStack alignItems="center" gap="$2">
                <Text
                  color={isCurrent ? colors.brand.blue : colors.text.primary}
                  fontSize={14}
                  fontWeight="600"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {displayTitle}
                </Text>
                {isCurrent && (
                  <YStack
                    backgroundColor={colors.brand.blue}
                    paddingHorizontal={6}
                    paddingVertical={2}
                    borderRadius={6}
                    flexShrink={0}
                  >
                    <Text color="#FFFFFF" fontSize={9} fontWeight="700" letterSpacing={0.5}>
                      {t("common.active")}
                    </Text>
                  </YStack>
                )}
              </XStack>
              <XStack gap="$2" alignItems="center">
                <Text color={colors.text.muted} fontSize={11} fontFamily="$mono">
                  {shortId}
                </Text>
                <Text color={colors.text.muted} fontSize={11}>
                  {formatDate(item.createdAt, t("common.yesterday"))}
                </Text>
              </XStack>
            </YStack>
          </XStack>
        )}
      </Pressable>
    );
  }
);

export const SessionListSheet = memo(
  ({
    visible,
    sessions,
    currentSessionId,
    onClose,
    onSelect,
    onCreate,
    onRefresh,
  }: Props) => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const [creating, setCreating] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const screenHeight = Dimensions.get("window").height;
    const slideAnim = useRef(new Animated.Value(screenHeight)).current;

    useEffect(() => {
      if (visible) {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      } else {
        slideAnim.setValue(screenHeight);
      }
    }, [visible, slideAnim, screenHeight]);

    const animatedClose = useCallback(() => {
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onClose());
    }, [slideAnim, screenHeight, onClose]);

    const handleCreate = useCallback(async () => {
      setCreating(true);
      try {
        const newId = await onCreate();
        if (newId) animatedClose();
      } finally {
        setCreating(false);
      }
    }, [onCreate, animatedClose]);

    const handleRefresh = useCallback(async () => {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }, [onRefresh]);

    const handleSelect = useCallback(
      (id: string) => {
        onSelect(id);
        animatedClose();
      },
      [onSelect, animatedClose]
    );

    return (
      <Modal
        visible={visible}
        animationType="none"
        transparent
        onRequestClose={animatedClose}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
          onPress={animatedClose}
        >
          <Animated.View
            style={{ flex: 1, marginTop: 80, transform: [{ translateY: slideAnim }] }}
          >
            <Pressable
              style={{ flex: 1 }}
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
                  {t("sessionList.title")}
                </Text>
                <XStack gap={8}>
                  <Pressable onPress={handleRefresh} disabled={refreshing}>
                    <YStack
                      paddingHorizontal={12}
                      paddingVertical={6}
                      borderRadius={12}
                      backgroundColor={colors.bg.tertiary}
                      borderWidth={1}
                      borderColor={colors.border.subtle}
                    >
                      <Text
                        color={refreshing ? colors.text.muted : colors.text.secondary}
                        fontSize={12}
                        fontWeight="600"
                      >
                        {refreshing ? "..." : t("common.refresh")}
                      </Text>
                    </YStack>
                  </Pressable>
                  <Pressable onPress={handleCreate} disabled={creating}>
                    <LinearGradient
                      colors={["#2CB5E8", "#8E2DE2"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={btnStyles.newBtn}
                    >
                      <Text
                        color={creating ? "rgba(255,255,255,0.5)" : "#FFFFFF"}
                        fontSize={12}
                        fontWeight="600"
                      >
                        {creating ? t("common.creating") : t("common.new")}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </XStack>
              </XStack>

              <XStack paddingHorizontal={16} paddingBottom={8}>
                <Text color={colors.text.muted} fontSize={12}>
                  {t("sessionList.sessionCount", { count: sessions.length })}
                </Text>
              </XStack>

              <FlatList
                data={sessions}
                keyExtractor={(s) => s.id}
                renderItem={({ item }) => (
                  <SessionRow
                    item={item}
                    isCurrent={item.id === currentSessionId}
                    onSelect={handleSelect}
                  />
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <YStack
                    alignItems="center"
                    justifyContent="center"
                    paddingVertical="$10"
                    gap={8}
                  >
                    <Text color={colors.text.muted} fontSize={14}>
                      {t("sessionList.noSessions")}
                    </Text>
                    <Text color={colors.text.muted} fontSize={12} opacity={0.7}>
                      {t("sessionList.createToStart")}
                    </Text>
                  </YStack>
                }
              />
            </YStack>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  }
);

const btnStyles = StyleSheet.create({
  newBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
