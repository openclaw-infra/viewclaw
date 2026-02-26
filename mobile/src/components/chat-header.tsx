import { Pressable } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import type { ConnectionStatus } from "../types/gateway";
import { useTheme } from "../theme/theme-context";

type Props = {
  sessionId: string;
  status: ConnectionStatus;
  sessionCount?: number;
  gatewayLabel?: string;
  agentId?: string;
  onSessionPress?: () => void;
  onGatewayPress?: () => void;
  onAgentPress?: () => void;
  onSettingsPress?: () => void;
};

export const ChatHeader = ({
  sessionId,
  status,
  sessionCount,
  gatewayLabel,
  agentId,
  onSessionPress,
  onGatewayPress,
  onAgentPress,
  onSettingsPress,
}: Props) => {
  const { colors } = useTheme();
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
        <XStack alignItems="center" gap="$2">
          <Text color={colors.text.primary} fontSize={20} fontWeight="700" letterSpacing={-0.5}>
            ViewClaw
          </Text>
          {agentId && (
            <Pressable onPress={onAgentPress}>
              <XStack
                alignItems="center"
                gap="$1"
                backgroundColor={colors.accent.purple + "18"}
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius={6}
                borderWidth={1}
                borderColor={colors.accent.purple + "30"}
              >
                <Text fontSize={11}>🤖</Text>
                <Text color={colors.accent.purple} fontSize={11} fontWeight="600">
                  {agentId}
                </Text>
                <Text color={colors.accent.purple} fontSize={9} opacity={0.6}>
                  ▾
                </Text>
              </XStack>
            </Pressable>
          )}
        </XStack>
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

      <YStack alignItems="flex-end" gap="$1.5">
        <XStack alignItems="center" gap="$2">
          <Pressable onPress={onSettingsPress}>
            <YStack
              paddingHorizontal="$2"
              paddingVertical="$1.5"
              borderRadius="$10"
              backgroundColor={colors.bg.elevated}
            >
              <Text fontSize={14}>⚙</Text>
            </YStack>
          </Pressable>
          <Pressable onPress={onGatewayPress}>
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
          </Pressable>
        </XStack>
        {gatewayLabel && (
          <Pressable onPress={onGatewayPress}>
            <Text color={colors.text.muted} fontSize={10}>
              {gatewayLabel} ▾
            </Text>
          </Pressable>
        )}
      </YStack>
    </XStack>
  );
};
