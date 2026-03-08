import { useRef, useEffect, useMemo, memo, useState, useCallback, createContext, useContext } from "react";
import { FlatList, Animated, Easing, Image, Pressable, Modal, Dimensions, View, StyleSheet, type GestureResponderEvent, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import Reanimated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay, Easing as REasing } from "react-native-reanimated";
import { Text, XStack, YStack, AnimatePresence } from "tamagui";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { ArrowDown, Forward, Reply } from "@tamagui/lucide-icons";
import type { ChatMessage, ExecutionLog, ImageAttachment, ReplyPreview, StreamItem } from "../types/gateway";
import { ProcessCard } from "./process-card";
import { MarkdownBody } from "./markdown-body";
import { MessageContextMenu, type MenuAction } from "./message-context-menu";
import { useTheme } from "../theme/theme-context";

type ChatStreamActions = {
  onForward?: (content: string) => void;
  onReply?: (reply: ReplyPreview) => void;
  scrollToQuote?: (quoteText: string) => void;
  highlightedId?: string | null;
};

const ChatStreamActionsContext = createContext<ChatStreamActions>({});

const logoIcon = require("../../assets/logo-icon.png");

type Props = {
  stream: StreamItem[];
  onForward?: (content: string) => void;
  onReply?: (reply: ReplyPreview) => void;
};

const StreamingCursor = () => {
  const { colors } = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 600, easing: REasing.inOut(REasing.ease) }),
        withTiming(1, { duration: 600, easing: REasing.inOut(REasing.ease) }),
      ),
      -1,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Reanimated.View
      style={[
        {
          width: 2,
          height: 16,
          backgroundColor: colors.brand.blue,
          borderRadius: 1,
          marginLeft: 1,
        },
        animStyle,
      ]}
    />
  );
};

const ImageGrid = memo(({ images }: { images: ImageAttachment[] }) => {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const screenWidth = Dimensions.get("window").width;

  return (
    <>
      <XStack flexWrap="wrap" gap={4} marginBottom={4}>
        {images.map((img, idx) => {
          const size = images.length === 1 ? 180 : 88;
          return (
            <Pressable key={idx} onPress={() => setPreviewUri(img.uri)}>
              <Image
                source={{ uri: img.uri }}
                style={{
                  width: size,
                  height: size,
                  borderRadius: 12,
                }}
                resizeMode="cover"
              />
            </Pressable>
          );
        })}
      </XStack>

      <Modal visible={!!previewUri} transparent animationType="fade">
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={() => setPreviewUri(null)}
        >
          {previewUri && (
            <Image
              source={{ uri: previewUri }}
              style={{
                width: screenWidth - 32,
                height: screenWidth - 32,
                borderRadius: 12,
              }}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </>
  );
});

const GeneratingLabel = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Text color={colors.text.muted} fontSize={12} marginRight={4} fontStyle="italic">
      {t("chat.generating")}
    </Text>
  );
};

const SHOW_INTERNAL_THINKING_SUMMARY = false;

const Bubble = memo(({ item }: { item: ChatMessage }) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const { onForward, onReply, scrollToQuote, highlightedId } = useContext(ChatStreamActionsContext);
  const isUser = item.role === "user";
  const time = new Date(item.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const statusLabel = isUser
    ? item.localStatus === "sending"
      ? t("chat.sending")
      : item.localStatus === "failed"
        ? t("chat.sendFailed")
        : null
    : null;

  const displayContent = useMemo(
    () => item.content,
    [item.content],
  );
  const replyPreview = item.replyTo;

  const isHighlighted = highlightedId === item.id;
  const highlightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isHighlighted) {
      highlightAnim.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(highlightAnim, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(highlightAnim, { toValue: 0.2, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(highlightAnim, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(highlightAnim, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [isHighlighted]);

  const handleQuotePress = useCallback(() => {
    if (replyPreview?.body && scrollToQuote) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scrollToQuote(replyPreview.body);
    }
  }, [replyPreview?.body, scrollToQuote]);

  const [menuVisible, setMenuVisible] = useState(false);
  const [pressPoint, setPressPoint] = useState<{ x: number; y: number } | null>(null);

  const handleLongPress = useCallback((e: GestureResponderEvent) => {
    if (item.streaming || !item.content) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPressPoint({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
    setMenuVisible(true);
  }, [item.streaming, item.content]);

  const handleMenuClose = useCallback(() => {
    setMenuVisible(false);
    setPressPoint(null);
  }, []);

  const extraActions = useMemo<MenuAction[]>(() => {
    const actions: MenuAction[] = [];
    if (onReply) {
      actions.push({
        id: "reply",
        label: t("contextMenu.reply"),
        icon: <Reply size={16} color={colors.text.primary} />,
        onPress: () => {
          handleMenuClose();
          onReply({
            messageId: item.id,
            body: displayContent,
            senderName: item.role === "user" ? "You" : "Assistant",
          });
        },
      });
    }
    if (onForward) {
      actions.push({
        id: "forward",
        label: t("contextMenu.forward"),
        icon: <Forward size={16} color={colors.text.primary} />,
        onPress: () => {
          handleMenuClose();
          onForward(item.content);
        },
      });
    }
    return actions;
  }, [onForward, onReply, t, colors.text.primary, handleMenuClose, item.id, item.role, item.content, displayContent]);

  return (
    <XStack
      justifyContent={isUser ? "flex-end" : "flex-start"}
      paddingHorizontal={12}
      marginBottom={8}
    >
      <Pressable onLongPress={handleLongPress} delayLongPress={400}>
          <View style={{ position: "relative" }}>
          <YStack
            animation="bouncy"
            enterStyle={{ opacity: 0, y: 8, scale: 0.97 }}
            maxWidth={Dimensions.get("window").width * 0.82}
            paddingHorizontal={14}
            paddingVertical={10}
            backgroundColor={isUser ? colors.bubble.user : colors.bubble.assistant}
            borderRadius={18}
            borderBottomRightRadius={isUser ? 4 : 18}
            borderBottomLeftRadius={isUser ? 18 : 4}
            borderWidth={isUser ? 1 : 1}
            borderColor={isUser ? colors.bubble.userBorder + "40" : colors.bubble.assistantBorder}
            gap={4}
            {...(!isUser && isDark && {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.15,
              shadowRadius: 3,
            })}
          >
            {item.images?.length ? <ImageGrid images={item.images} /> : null}

            {SHOW_INTERNAL_THINKING_SUMMARY && item.thinkingSummary ? (
              <XStack alignItems="center" gap={4} marginBottom={2}>
                <View style={[emptyStyles.thinkDot, { backgroundColor: colors.accent.yellow }]} />
                <Text color={colors.accent.yellow} fontSize={11} opacity={0.85} fontWeight="500">
                  {item.thinkingSummary}
                </Text>
              </XStack>
            ) : null}

            {replyPreview && (
              <Pressable onPress={handleQuotePress} style={{ alignSelf: "flex-start", maxWidth: Math.round((Dimensions.get("window").width - 24) * 0.5) }}>
                <XStack
                  backgroundColor={isUser ? "rgba(255,255,255,0.12)" : colors.bg.tertiary}
                  borderRadius={8}
                  paddingHorizontal={10}
                  paddingVertical={6}
                  marginBottom={2}
                  alignItems="center"
                  gap={6}
                >
                  <Reply size={11} color={isUser ? "rgba(255,255,255,0.55)" : colors.text.muted} style={{ flexShrink: 0 }} />
                  <Text
                    color={isUser ? "rgba(255,255,255,0.65)" : colors.text.muted}
                    fontSize={12}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    flexShrink={1}
                  >
                    {replyPreview.body}
                  </Text>
                </XStack>
              </Pressable>
            )}

            {displayContent ? (
              <MarkdownBody color={isUser ? "#FFFFFF" : colors.text.primary}>
                {displayContent}
              </MarkdownBody>
            ) : null}

            {item.streaming ? (
              <XStack alignItems="center" height={20}>
                {!item.content && (
                  <GeneratingLabel />
                )}
                <StreamingCursor />
              </XStack>
            ) : (
              <XStack alignItems="center" gap={6} alignSelf={isUser ? "flex-end" : "flex-start"}>
                <Text
                  color={isUser ? "rgba(255,255,255,0.45)" : colors.text.muted}
                  fontSize={10}
                >
                  {time}
                </Text>
                {statusLabel && (
                  <Text
                    color={item.localStatus === "failed" ? "#FF6B6B" : isUser ? "rgba(255,255,255,0.6)" : colors.text.muted}
                    fontSize={10}
                    fontWeight="600"
                  >
                    {statusLabel}
                  </Text>
                )}
              </XStack>
            )}
          </YStack>
          {isHighlighted && (
            <Animated.View
              pointerEvents="none"
              style={{
                ...StyleSheet.absoluteFillObject,
                borderRadius: 18,
                backgroundColor: colors.brand.blue,
                opacity: highlightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }),
              }}
            />
          )}
          </View>
      </Pressable>

      <MessageContextMenu
        visible={menuVisible}
        pressPoint={pressPoint}
        content={item.content}
        extraActions={extraActions}
        onClose={handleMenuClose}
      />
    </XStack>
  );
});

const TypingDot = ({ color, delay }: { color: string; delay: number }) => {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: REasing.inOut(REasing.ease) }),
          withTiming(0.35, { duration: 700, easing: REasing.inOut(REasing.ease) }),
        ),
        -1,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Reanimated.View
      style={[
        { width: 6, height: 6, borderRadius: 3, backgroundColor: color },
        animStyle,
      ]}
    />
  );
};

const TypingIndicator = () => {
  const { colors } = useTheme();
  return (
    <XStack justifyContent="flex-start" paddingHorizontal={12} marginBottom={8}>
      <XStack
        animation="bouncy"
        enterStyle={{ opacity: 0, scale: 0.9, y: 6 }}
        paddingHorizontal={14}
        paddingVertical={12}
        backgroundColor={colors.bubble.assistant}
        borderRadius={18}
        borderBottomLeftRadius={4}
        borderWidth={1}
        borderColor={colors.bubble.assistantBorder}
        gap={5}
        alignItems="center"
      >
        <TypingDot color={colors.brand.blue} delay={0} />
        <TypingDot color={colors.brand.blue} delay={160} />
        <TypingDot color={colors.brand.blue} delay={320} />
      </XStack>
    </XStack>
  );
};

const emptyStyles = StyleSheet.create({
  thinkDot: { width: 4, height: 4, borderRadius: 2 },
});

type DisplayItem =
  | { kind: "message"; id: string; data: ChatMessage }
  | { kind: "process"; id: string; logs: ExecutionLog[] }
  | { kind: "typing"; id: string }
  | { kind: "dateSeparator"; id: string; timestamp: number };

const groupStreamItems = (stream: StreamItem[]): DisplayItem[] => {
  const result: DisplayItem[] = [];
  let currentLogs: ExecutionLog[] = [];

  const flushLogs = (followedByMessage: boolean) => {
    if (currentLogs.length === 0) return;
    const hasDone = currentLogs.some((l) => l.level === "done");
    const isComplete = hasDone || followedByMessage;
    if (!hasDone && isComplete) {
      currentLogs.push({
        id: `synthetic-done-${currentLogs[0].id}`,
        level: "done",
        text: "Done",
        createdAt: Date.now(),
      });
    }
    result.push({
      kind: "process",
      id: `process-${currentLogs[0].id}`,
      logs: [...currentLogs],
    });
    currentLogs = [];
  };

  for (const item of stream) {
    if (item.kind === "log") {
      currentLogs.push(item.data);
    } else {
      const closesProcess = item.kind === "message";
      flushLogs(closesProcess);
      if (item.kind === "message") {
        result.push({ kind: "message", id: item.data.id, data: item.data });
      } else {
        result.push({ kind: "typing", id: item.id });
      }
    }
  }
  flushLogs(false);
  return result;
};

const getItemTimestamp = (item: DisplayItem): number | null => {
  if (item.kind === "message") return item.data.createdAt;
  if (item.kind === "process" && item.logs.length > 0) return item.logs[0].createdAt;
  return null;
};

const startOfDay = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const insertDateSeparators = (items: DisplayItem[]): DisplayItem[] => {
  if (items.length === 0) return items;
  const result: DisplayItem[] = [];
  let lastDayStart: number | null = null;

  for (const item of items) {
    const ts = getItemTimestamp(item);
    if (ts !== null) {
      const dayStart = startOfDay(ts);
      if (lastDayStart === null || dayStart !== lastDayStart) {
        result.push({ kind: "dateSeparator", id: `date-${dayStart}`, timestamp: ts });
        lastDayStart = dayStart;
      }
    }
    result.push(item);
  }
  return result;
};

const DateSeparator = memo(({ timestamp }: { timestamp: number }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const label = useMemo(() => {
    const now = new Date();
    const target = new Date(timestamp);
    const todayStart = startOfDay(now.getTime());
    const targetStart = startOfDay(timestamp);
    const diffDays = Math.round((todayStart - targetStart) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t("chat.dateToday");
    if (diffDays === 1) return t("chat.dateYesterday");
    if (diffDays <= 7) return t("chat.dateDaysAgo", { count: diffDays });
    return target.toLocaleDateString(undefined, { month: "short", day: "numeric", year: target.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  }, [timestamp, t]);

  return (
    <XStack justifyContent="center" paddingVertical={12} paddingHorizontal={16} alignItems="center" gap={12}>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle }} />
      <Text color={colors.text.muted} fontSize={11} fontWeight="500">
        {label}
      </Text>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle }} />
    </XStack>
  );
});

const getDisplayItemId = (item: DisplayItem): string => item.id;

const RenderDisplayItem = memo(({ item }: { item: DisplayItem }) => {
  if (item.kind === "typing") return <TypingIndicator />;
  if (item.kind === "message") return <Bubble item={item.data} />;
  if (item.kind === "dateSeparator") return <DateSeparator timestamp={item.timestamp} />;
  return <ProcessCard logs={item.logs} />;
});

const EmptyState = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      paddingVertical="$10"
      gap={12}
      transform={[{ rotateX: "180deg" }]}
    >
      <Image source={logoIcon} style={{ width: 56, height: 56, opacity: 0.6 }} resizeMode="contain" />
      <Text color={colors.text.muted} fontSize={14} fontWeight="500">
        {t("chat.emptyTitle")}
      </Text>
      <Text color={colors.text.muted} fontSize={12} opacity={0.6}>
        {t("chat.emptyHint")}
      </Text>
    </YStack>
  );
};

const SCROLL_THRESHOLD = 200;

const ScrollToBottomButton = memo(({ visible, onPress }: { visible: boolean; onPress: () => void }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {visible && (
        <YStack
          key="scroll-btn"
          animation="quick"
          position="absolute"
          bottom={12}
          alignSelf="center"
          enterStyle={{ opacity: 0, y: 8 }}
          exitStyle={{ opacity: 0, y: 8 }}
        >
          <Pressable onPress={onPress}>
            <XStack
              backgroundColor={colors.bg.secondary}
              borderRadius={20}
              paddingHorizontal={14}
              paddingVertical={8}
              alignItems="center"
              gap={6}
              borderWidth={1}
              borderColor={colors.border.subtle}
              shadowColor="#000"
              shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={0.12}
              shadowRadius={6}
              elevation={4}
            >
              <ArrowDown size={14} color={colors.brand.blue} />
              <Text color={colors.brand.blue} fontSize={12} fontWeight="600">
                {t("chat.latestMessage")}
              </Text>
            </XStack>
          </Pressable>
        </YStack>
      )}
    </AnimatePresence>
  );
});

export const ChatStream = ({ stream, onForward, onReply }: Props) => {
  const grouped = useMemo(() => groupStreamItems(stream), [stream]);
  const withDates = useMemo(() => insertDateSeparators(grouped), [grouped]);
  const reversed = useMemo(() => [...withDates].reverse(), [withDates]);
  const listRef = useRef<FlatList>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    setIsAtBottom(offsetY < SCROLL_THRESHOLD);
  }, []);

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const scrollToQuote = useCallback((quoteText: string) => {
    const target = reversed.findIndex((di) => {
      if (di.kind !== "message") return false;
      const c = di.data.content;
      return c.includes(quoteText);
    });
    if (target === -1) return;
    const targetItem = reversed[target];
    listRef.current?.scrollToIndex({ index: target, animated: true, viewPosition: 0.5 });
    if (targetItem.kind === "message") {
      setHighlightedId(targetItem.id);
      setTimeout(() => setHighlightedId(null), 1500);
    }
  }, [reversed]);

  const handleScrollToIndexFailed = useCallback((info: { index: number }) => {
    listRef.current?.scrollToOffset({ offset: info.index * 100, animated: true });
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
    }, 300);
  }, []);

  const actions = useMemo<ChatStreamActions>(
    () => ({ onForward, onReply, scrollToQuote, highlightedId }),
    [onForward, onReply, scrollToQuote, highlightedId],
  );

  return (
    <View style={{ flex: 1 }}>
      <ChatStreamActionsContext.Provider value={actions}>
        <FlatList
          ref={listRef}
          inverted
          data={reversed}
          keyExtractor={getDisplayItemId}
          renderItem={({ item }) => <RenderDisplayItem item={item} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState />}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onScrollToIndexFailed={handleScrollToIndexFailed}
        />
      </ChatStreamActionsContext.Provider>
      <ScrollToBottomButton visible={!isAtBottom} onPress={scrollToBottom} />
    </View>
  );
};
