import { useState } from "react";
import { Pressable } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import type { ExecutionLog } from "../types/gateway";
import { colors } from "../theme/colors";

type Props = {
  log: ExecutionLog;
};

const META: Record<
  ExecutionLog["level"],
  { label: string; icon: string; color: string; bg: string }
> = {
  thought: {
    label: "Thinking",
    icon: "💭",
    color: colors.log.thought,
    bg: "rgba(251,191,36,0.06)",
  },
  action: {
    label: "Tool Call",
    icon: "⚡",
    color: colors.log.action,
    bg: "rgba(34,197,94,0.06)",
  },
  observation: {
    label: "Result",
    icon: "📋",
    color: colors.log.observation,
    bg: "rgba(34,211,238,0.06)",
  },
  error: {
    label: "Error",
    icon: "✕",
    color: colors.log.error,
    bg: "rgba(239,68,68,0.08)",
  },
  done: {
    label: "Completed",
    icon: "✓",
    color: colors.log.done,
    bg: "rgba(167,139,250,0.06)",
  },
  status: {
    label: "System",
    icon: "●",
    color: colors.log.status,
    bg: "rgba(100,116,139,0.06)",
  },
};

export const EventCard = ({ log }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const meta = META[log.level];
  const hasDetail = !!log.detail;

  return (
    <Pressable onPress={hasDetail ? () => setExpanded((p) => !p) : undefined}>
      <XStack
        marginHorizontal="$3"
        marginBottom="$1.5"
        borderRadius={12}
        backgroundColor={meta.bg}
        overflow="hidden"
      >
        <YStack width={3} backgroundColor={meta.color} />

        <YStack flex={1} paddingHorizontal="$2.5" paddingVertical="$2" gap="$1">
          <XStack alignItems="center" gap="$1.5">
            <Text fontSize={11}>{meta.icon}</Text>
            <Text
              color={meta.color}
              fontSize={11}
              fontWeight="600"
              textTransform="uppercase"
              letterSpacing={0.5}
            >
              {log.toolName ?? meta.label}
            </Text>
            {hasDetail && (
              <Text color={colors.text.muted} fontSize={10} marginLeft="auto">
                {expanded ? "▾" : "▸"}
              </Text>
            )}
          </XStack>

          <Text
            color={colors.text.secondary}
            fontSize={13}
            fontFamily="$mono"
            numberOfLines={expanded ? undefined : 2}
            lineHeight={18}
          >
            {log.text}
          </Text>

          {expanded && log.detail ? (
            <YStack
              marginTop="$1"
              padding="$2"
              backgroundColor="rgba(0,0,0,0.3)"
              borderRadius={8}
            >
              <Text
                color={colors.text.muted}
                fontSize={11}
                fontFamily="$mono"
                numberOfLines={12}
                lineHeight={16}
              >
                {log.detail}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      </XStack>
    </Pressable>
  );
};
