import { memo, useCallback, useMemo, useState, useRef, useEffect } from "react";
import { FlatList, Pressable, Modal, StyleSheet, Animated, Dimensions, Easing, View, PanResponder } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Bot, X } from "@tamagui/lucide-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/theme-context";
import type { AgentInfo, SessionInfo } from "../types/gateway";

type Props = {
  visible: boolean;
  sessions: SessionInfo[];
  agents: AgentInfo[];
  currentSessionId: string;
  onClose: () => void;
  onSelect: (sessionId: string) => void;
  onCreate: (agentId?: string) => Promise<string | null>;
  onRefresh: () => Promise<void>;
};

const DRAWER_WIDTH_RATIO = 0.85;
const SWIPE_THRESHOLD = 60;

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
    const rawTitle = item.title || (item.sessionKey
      ? item.sessionKey.replace(/^agent:\w+:/, "").replace(/^openresponses:/, "").slice(0, 20)
      : shortId);
    const displayTitle = rawTitle;

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
                {item.agentId && (
                  <YStack
                    backgroundColor={colors.brand.blue + "18"}
                    paddingHorizontal={5}
                    paddingVertical={1}
                    borderRadius={3}
                  >
                    <Text color={colors.brand.blue} fontSize={9} fontWeight="600">
                      {item.agentId}
                    </Text>
                  </YStack>
                )}
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

type SessionListItem =
  | { kind: "session"; data: SessionInfo }
  | { kind: "dateSeparator"; label: string; id: string };

const startOfDay = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const buildSessionListItems = (sessions: SessionInfo[], t: (key: string, opts?: Record<string, unknown>) => string): SessionListItem[] => {
  if (sessions.length === 0) return [];
  const now = new Date();
  const todayStart = startOfDay(now.getTime());
  const result: SessionListItem[] = [];
  let lastDayStart: number | null = null;

  for (const s of sessions) {
    const ts = s.createdAt ? new Date(s.createdAt).getTime() : 0;
    const dayStart = startOfDay(ts);

    if (dayStart !== lastDayStart) {
      const diffDays = Math.round((todayStart - dayStart) / (1000 * 60 * 60 * 24));
      let label: string;
      if (diffDays === 0) label = t("chat.dateToday");
      else if (diffDays === 1) label = t("chat.dateYesterday");
      else if (diffDays <= 7) label = t("chat.dateDaysAgo", { count: diffDays });
      else {
        const d = new Date(ts);
        label = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
      }
      result.push({ kind: "dateSeparator", label, id: `date-${dayStart}` });
      lastDayStart = dayStart;
    }
    result.push({ kind: "session", data: s });
  }
  return result;
};

const SessionDateSeparator = memo(({ label }: { label: string }) => {
  const { colors } = useTheme();
  return (
    <XStack paddingHorizontal={16} paddingTop={16} paddingBottom={6} alignItems="center" gap={10}>
      <Text color={colors.text.muted} fontSize={11} fontWeight="600">
        {label}
      </Text>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle }} />
    </XStack>
  );
});

const getSessionListItemId = (item: SessionListItem): string =>
  item.kind === "session" ? item.data.id : item.id;

export const SessionListSheet = memo(
  ({
    visible,
    sessions,
    agents,
    currentSessionId,
    onClose,
    onSelect,
    onCreate,
    onRefresh,
  }: Props) => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const visibleSessions = useMemo(() => sessions.filter((s) => !s.id.startsWith("pending-")), [sessions]);
    const listItems = useMemo(() => buildSessionListItems(visibleSessions, t), [visibleSessions, t]);
    const [creating, setCreating] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [agentPickerVisible, setAgentPickerVisible] = useState(false);

    const screenWidth = Dimensions.get("window").width;
    const drawerWidth = screenWidth * DRAWER_WIDTH_RATIO;
    const slideAnim = useRef(new Animated.Value(-drawerWidth)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (visible) {
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 20,
            mass: 1,
            stiffness: 180,
            useNativeDriver: true,
          }),
          Animated.spring(backdropAnim, {
            toValue: 1,
            damping: 20,
            stiffness: 180,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        slideAnim.setValue(-drawerWidth);
        backdropAnim.setValue(0);
      }
    }, [visible, slideAnim, backdropAnim, drawerWidth]);

    const animatedClose = useCallback(() => {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -drawerWidth,
          damping: 20,
          stiffness: 250,
          useNativeDriver: true,
        }),
        Animated.spring(backdropAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 250,
          useNativeDriver: true,
        }),
      ]).start(() => onClose());
    }, [slideAnim, backdropAnim, drawerWidth, onClose]);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) && g.dx < 0,
        onPanResponderMove: (_, g) => {
          if (g.dx < 0) slideAnim.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < -SWIPE_THRESHOLD || g.vx < -0.5) {
            Animated.parallel([
              Animated.spring(slideAnim, {
                toValue: -drawerWidth,
                damping: 20,
                stiffness: 250,
                useNativeDriver: true,
              }),
              Animated.spring(backdropAnim, {
                toValue: 0,
                damping: 20,
                stiffness: 250,
                useNativeDriver: true,
              }),
            ]).start(() => onClose());
          } else {
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: true,
              tension: 120,
              friction: 14,
            }).start();
          }
        },
      }),
    ).current;

    const handleCreateWithAgent = useCallback(async (agentId?: string) => {
      setAgentPickerVisible(false);
      setCreating(true);
      try {
        const newId = await onCreate(agentId);
        if (newId) animatedClose();
      } finally {
        setCreating(false);
      }
    }, [onCreate, animatedClose]);

    const handleCreatePress = useCallback(() => {
      if (agents.length > 1) {
        setAgentPickerVisible(true);
      } else {
        handleCreateWithAgent(agents[0]?.id);
      }
    }, [agents, handleCreateWithAgent]);

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
        statusBarTranslucent
        onRequestClose={animatedClose}
      >
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
          <Animated.View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: "rgba(0,0,0,0.5)",
              opacity: backdropAnim,
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={animatedClose} />
          </Animated.View>

          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: drawerWidth,
              transform: [{ translateX: slideAnim }],
            }}
          >
          <YStack
            flex={1}
            backgroundColor={colors.bg.secondary}
            borderTopRightRadius={24}
            borderBottomRightRadius={24}
            overflow="hidden"
            shadowColor="#000"
            shadowOffset={{ width: 4, height: 0 }}
            shadowOpacity={0.15}
            shadowRadius={16}
            elevation={8}
          >
            <YStack paddingTop={insets.top + 8} />

            <XStack
              alignItems="center"
              justifyContent="space-between"
              paddingHorizontal={16}
              paddingVertical={12}
            >
              <Text
                color={colors.text.primary}
                fontSize={20}
                fontWeight="700"
              >
                {t("sessionList.title")}
              </Text>
              <XStack gap={8} alignItems="center">
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
                <Pressable onPress={handleCreatePress} disabled={creating}>
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
                {t("sessionList.sessionCount", { count: visibleSessions.length })}
              </Text>
            </XStack>

            <FlatList
              data={listItems}
              keyExtractor={getSessionListItemId}
              renderItem={({ item }) =>
                item.kind === "dateSeparator" ? (
                  <SessionDateSeparator label={item.label} />
                ) : (
                  <SessionRow
                    item={item.data}
                    isCurrent={item.data.id === currentSessionId}
                    onSelect={handleSelect}
                  />
                )
              }
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
        </Animated.View>
        </View>

        {agentPickerVisible && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAgentPickerVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
              <Pressable onPress={(e) => e.stopPropagation?.()}>
                <YStack
                  backgroundColor={colors.bg.secondary}
                  borderRadius={24}
                  width={300}
                  overflow="hidden"
                  shadowColor="#000"
                  shadowOffset={{ width: 0, height: 8 }}
                  shadowOpacity={0.2}
                  shadowRadius={24}
                  elevation={8}
                >
                  <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    paddingHorizontal={20}
                    paddingTop={20}
                    paddingBottom={4}
                  >
                    <Text color={colors.text.primary} fontSize={16} fontWeight="700">
                      {t("sessionList.selectAgent")}
                    </Text>
                    <Pressable onPress={() => setAgentPickerVisible(false)} hitSlop={8}>
                      <YStack
                        width={28}
                        height={28}
                        borderRadius={14}
                        backgroundColor={colors.bg.tertiary}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <X size={14} color={colors.text.muted} />
                      </YStack>
                    </Pressable>
                  </XStack>

                  <YStack paddingHorizontal={12} paddingTop={12} paddingBottom={16} gap={8}>
                    {agents.map((agent) => (
                      <Pressable
                        key={agent.id}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          handleCreateWithAgent(agent.id);
                        }}
                      >
                        {({ pressed }) => (
                          <XStack
                            paddingHorizontal={16}
                            paddingVertical={14}
                            alignItems="center"
                            gap={12}
                            backgroundColor={pressed ? colors.bg.elevated : colors.bg.tertiary}
                            borderRadius={14}
                            borderWidth={1}
                            borderColor={pressed ? colors.brand.blue + "40" : colors.border.subtle}
                          >
                            <YStack
                              width={36}
                              height={36}
                              borderRadius={10}
                              backgroundColor={colors.brand.blue + "15"}
                              alignItems="center"
                              justifyContent="center"
                            >
                              <Bot size={18} color={colors.brand.blue} />
                            </YStack>
                            <YStack flex={1} gap={2}>
                              <Text color={colors.text.primary} fontSize={14} fontWeight="600">
                                {agent.id}
                              </Text>
                              {agent.model && (
                                <Text color={colors.text.muted} fontSize={11} numberOfLines={1}>
                                  {agent.model}
                                </Text>
                              )}
                            </YStack>
                            <YStack
                              backgroundColor={colors.bg.elevated}
                              paddingHorizontal={8}
                              paddingVertical={3}
                              borderRadius={6}
                            >
                              <Text color={colors.text.muted} fontSize={10} fontWeight="500">
                                {agent.sessionCount}
                              </Text>
                            </YStack>
                          </XStack>
                        )}
                      </Pressable>
                    ))}
                  </YStack>
                </YStack>
              </Pressable>
            </View>
          </Pressable>
        )}
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
