import { useRef, useEffect } from "react";
import { FlatList } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import type { ChatMessage } from "../types/gateway";
import { colors } from "../theme/colors";

type Props = {
  messages: ChatMessage[];
};

const Bubble = ({ item }: { item: ChatMessage }) => {
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
        {item.thinkingSummary ? (
          <Text color={colors.accent.yellow} fontSize={11} opacity={0.8}>
            {item.thinkingSummary}
          </Text>
        ) : null}

        <Text
          color={isUser ? "#FFFFFF" : colors.text.primary}
          fontSize={15}
          lineHeight={22}
        >
          {item.content}
        </Text>

        <Text
          color={isUser ? "rgba(255,255,255,0.5)" : colors.text.muted}
          fontSize={10}
          alignSelf={isUser ? "flex-end" : "flex-start"}
        >
          {time}
        </Text>
      </YStack>
    </XStack>
  );
};

export const ChatStream = ({ messages }: Props) => {
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <Bubble item={item} />}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <YStack flex={1} alignItems="center" justifyContent="center" paddingVertical="$10" gap="$3">
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
