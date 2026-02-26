import { useRef, useEffect, useCallback, memo, useState } from "react";
import { FlatList, Animated, Easing, Image, Pressable, Modal, Dimensions } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import type { ChatMessage, ImageAttachment, StreamItem } from "../types/gateway";
import { EventCard } from "./event-card";
import { MarkdownBody } from "./markdown-body";
import { colors } from "../theme/colors";

type Props = {
  stream: StreamItem[];
};

const StreamingCursor = () => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
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
        backgroundColor: colors.accent.blue,
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
                  borderRadius: 10,
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
            backgroundColor: "rgba(0,0,0,0.9)",
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

const Bubble = memo(({ item }: { item: ChatMessage }) => {
  const isUser = item.role === "user";
  const time = new Date(item.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <XStack
      justifyContent={isUser ? "flex-end" : "flex-start"}
      paddingHorizontal="$3"
      marginBottom="$2.5"
    >
      <YStack
        maxWidth="82%"
        paddingHorizontal="$3.5"
        paddingVertical="$2.5"
        backgroundColor={isUser ? colors.bubble.user : colors.bubble.assistant}
        borderRadius={18}
        borderBottomRightRadius={isUser ? 4 : 18}
        borderBottomLeftRadius={isUser ? 18 : 4}
        borderWidth={isUser ? 0 : 1}
        borderColor={colors.bubble.assistantBorder}
        gap="$1"
      >
        {item.images?.length ? <ImageGrid images={item.images} /> : null}

        {item.thinkingSummary ? (
          <Text color={colors.accent.yellow} fontSize={11} opacity={0.8}>
            {item.thinkingSummary}
          </Text>
        ) : null}

        {item.content ? (
          <MarkdownBody color={isUser ? "#FFFFFF" : colors.text.primary}>
            {item.content}
          </MarkdownBody>
        ) : null}

        {item.streaming ? (
          <XStack alignItems="center" height={20}>
            {!item.content && (
              <Text color={colors.text.muted} fontSize={12} marginRight={4}>
                Generating
              </Text>
            )}
            <StreamingCursor />
          </XStack>
        ) : (
          <Text
            color={isUser ? "rgba(255,255,255,0.5)" : colors.text.muted}
            fontSize={10}
            alignSelf={isUser ? "flex-end" : "flex-start"}
          >
            {time}
          </Text>
        )}
      </YStack>
    </XStack>
  );
});

const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 350, easing: Easing.ease, useNativeDriver: true }),
        ])
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <XStack justifyContent="flex-start" paddingHorizontal="$3" marginBottom="$2.5">
      <XStack
        paddingHorizontal="$3.5"
        paddingVertical="$3"
        backgroundColor={colors.bubble.assistant}
        borderRadius={18}
        borderBottomLeftRadius={4}
        borderWidth={1}
        borderColor={colors.bubble.assistantBorder}
        gap={6}
        alignItems="center"
      >
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: colors.text.muted,
              opacity: dot,
            }}
          />
        ))}
      </XStack>
    </XStack>
  );
};

const getItemId = (item: StreamItem): string =>
  item.kind === "typing" ? item.id : item.data.id;

const renderItem = ({ item }: { item: StreamItem }) => {
  if (item.kind === "typing") return <TypingIndicator />;
  if (item.kind === "message") return <Bubble item={item.data} />;
  return <EventCard log={item.data} />;
};

export const ChatStream = ({ stream }: Props) => {
  const listRef = useRef<FlatList>(null);
  const isNearBottomRef = useRef(true);

  const lastStreamingContent = stream.reduce((acc, item) => {
    if (item.kind === "message" && item.data.streaming) return item.data.content.length;
    return acc;
  }, 0);

  const onScroll = useCallback((e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottomRef.current = distanceFromBottom < 120;
  }, []);

  useEffect(() => {
    if (stream.length > 0 && isNearBottomRef.current) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [stream.length, lastStreamingContent]);

  return (
    <FlatList
      ref={listRef}
      data={stream}
      extraData={lastStreamingContent}
      keyExtractor={getItemId}
      renderItem={renderItem}
      onScroll={onScroll}
      scrollEventThrottle={100}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <YStack
          flex={1}
          alignItems="center"
          justifyContent="center"
          paddingVertical="$10"
          gap="$3"
        >
          <Text color={colors.text.muted} fontSize={32}>
            {"{ }"}
          </Text>
          <Text color={colors.text.muted} fontSize={14}>
            Send a task to OpenClaw
          </Text>
        </YStack>
      }
    />
  );
};
