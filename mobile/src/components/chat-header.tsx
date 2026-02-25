import { Pressable } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import type { ConnectionStatus } from "../types/gateway";
import { colors } from "../theme/colors";

type Props = {
  sessionId: string;
  status: ConnectionStatus;
  sessionCount?: number;
  onSessionPress?: () => void;
};

export const ChatHeader = ({ sessionId, status, sessionCount, onSessionPress }: Props) => {
  const statusColor = colors.status[status];
  const shortId = sessionId ? sessionId.slice(0, 8) : "---";

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$4"
      paddingVertical="$3"
    >
      <YStack gap="$1">
        <Text color={colors.text.primary} fontSize={20} fontWeight="700" letterSpacing={-0.5}>
          ViewClaw
        </Text>
        <Pressable onPress={onSessionPress}>
          <XStack alignItems="center" gap="$1.5">
            <Text color={colors.text.muted} fontSize={12} fontFamily="$mono">
              {shortId}
            </Text>
            {sessionCount != null && sessionCount > 0 && (
              <YStack
                backgroundColor={colors.bg.elevated}
                paddingHorizontal="$1.5"
                paddingVertical={1}
                borderRadius={4}
              >
                <Text color={colors.text.muted} fontSize={10} fontWeight="600">
                  {sessionCount}
                </Text>
              </YStack>
            )}
            <Text color={colors.text.muted} fontSize={10}>
              ▾
            </Text>
          </XStack>
        </Pressable>
      </YStack>

      <XStack alignItems="center" gap="$2">
        <XStack
          alignItems="center"
          gap="$1.5"
          backgroundColor={colors.bg.elevated}
          paddingHorizontal="$2.5"
          paddingVertical="$1.5"
          borderRadius="$10"
        >
          <YStack
            width={6}
            height={6}
            borderRadius={3}
            backgroundColor={statusColor}
          />
          <Text color={colors.text.secondary} fontSize={11} textTransform="uppercase" letterSpacing={0.5}>
            {status}
          </Text>
        </XStack>
      </XStack>
    </XStack>
  );
};
