import { useRef, useEffect, useMemo, memo, useState, useCallback } from "react";
import { FlatList, Animated, Easing, Image, Pressable, Modal, Dimensions, View, StyleSheet, type LayoutRectangle } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import type { ChatMessage, ExecutionLog, ImageAttachment, StreamItem } from "../types/gateway";
import { ProcessCard } from "./process-card";
import { MarkdownBody } from "./markdown-body";
import { MessageContextMenu } from "./message-context-menu";
import { useTheme } from "../theme/theme-context";

const logoIcon = require("../../assets/logo-icon.png");

type Props = {
  stream: StreamItem[];
};

const StreamingCursor = () => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: 2,
        height: 16,
        backgroundColor: colors.brand.blue,
        borderRadius: 1,
        opacity,
        marginLeft: 1,
      }}
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

const Bubble = memo(({ item }: { item: ChatMessage }) => {
  const { colors, isDark } = useTheme();
  const isUser = item.role === "user";
  const time = new Date(item.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const bubbleRef = useRef<View>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<LayoutRectangle | null>(null);

  const handleLongPress = useCallback(() => {
    if (item.streaming || !item.content) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    bubbleRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ x, y, width, height });
      setMenuVisible(true);
    });
  }, [item.streaming, item.content]);

  const handleMenuClose = useCallback(() => {
    setMenuVisible(false);
    setMenuAnchor(null);
  }, []);

  return (
    <XStack
      justifyContent={isUser ? "flex-end" : "flex-start"}
      paddingHorizontal={12}
      marginBottom={8}
    >
      <Pressable onLongPress={handleLongPress} delayLongPress={400}>
        <View ref={bubbleRef} collapsable={false}>
          <YStack
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

            {item.thinkingSummary ? (
              <XStack alignItems="center" gap={4} marginBottom={2}>
                <View style={[emptyStyles.thinkDot, { backgroundColor: colors.accent.yellow }]} />
                <Text color={colors.accent.yellow} fontSize={11} opacity={0.85} fontWeight="500">
                  {item.thinkingSummary}
                </Text>
              </XStack>
            ) : null}

            {item.content ? (
              <MarkdownBody color={isUser ? "#FFFFFF" : colors.text.primary}>
                {item.content}
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
              <Text
                color={isUser ? "rgba(255,255,255,0.45)" : colors.text.muted}
                fontSize={10}
                alignSelf={isUser ? "flex-end" : "flex-start"}
              >
                {time}
              </Text>
            )}
          </YStack>
        </View>
      </Pressable>

      <MessageContextMenu
        visible={menuVisible}
        anchorRect={menuAnchor}
        content={item.content}
        onClose={handleMenuClose}
      />
    </XStack>
  );
});

const TypingIndicator = () => {
  const { colors } = useTheme();
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <XStack justifyContent="flex-start" paddingHorizontal={12} marginBottom={8}>
      <XStack
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
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.brand.blue,
              opacity: dot,
            }}
          />
        ))}
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
  | { kind: "typing"; id: string };

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

const getDisplayItemId = (item: DisplayItem): string => item.id;

const RenderDisplayItem = memo(({ item }: { item: DisplayItem }) => {
  if (item.kind === "typing") return <TypingIndicator />;
  if (item.kind === "message") return <Bubble item={item.data} />;
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
      transform={[{ scaleY: -1 }]}
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

export const ChatStream = ({ stream }: Props) => {
  const grouped = useMemo(() => groupStreamItems(stream), [stream]);
  const reversed = useMemo(() => [...grouped].reverse(), [grouped]);

  return (
    <FlatList
      inverted
      data={reversed}
      keyExtractor={getDisplayItemId}
      renderItem={({ item }) => <RenderDisplayItem item={item} />}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={<EmptyState />}
    />
  );
};
