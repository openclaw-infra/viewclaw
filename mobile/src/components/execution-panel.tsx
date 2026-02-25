import { useMemo, useState, useRef, useEffect } from "react";
import { ScrollView, Pressable } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import type { ExecutionLog } from "../types/gateway";
import { colors } from "../theme/colors";

type Props = {
  logs: ExecutionLog[];
  expanded?: boolean;
  onToggle?: () => void;
};

const LEVEL_LABEL: Record<ExecutionLog["level"], string> = {
  thought: "THINK",
  action: "EXEC",
  observation: "OUT",
  error: "ERR",
  done: "DONE",
  status: "SYS",
};

const LogLine = ({ log }: { log: ExecutionLog }) => {
  const [showDetail, setShowDetail] = useState(false);
  const levelColor = colors.log[log.level];

  return (
    <Pressable onPress={() => log.detail && setShowDetail((p) => !p)}>
      <XStack gap="$2" alignItems="flex-start" paddingVertical="$1">
        <Text
          color={levelColor}
          fontSize={10}
          fontFamily="$mono"
          fontWeight="700"
          width={42}
          textAlign="right"
          marginTop={1}
        >
          {LEVEL_LABEL[log.level]}
        </Text>
        <YStack flex={1} gap="$0.5">
          <Text color={colors.text.primary} fontSize={12} fontFamily="$mono" numberOfLines={showDetail ? undefined : 2}>
            {log.text}
          </Text>
          {showDetail && log.detail ? (
            <Text color={colors.text.muted} fontSize={11} fontFamily="$mono" numberOfLines={8}>
              {log.detail}
            </Text>
          ) : null}
        </YStack>
      </XStack>
    </Pressable>
  );
};

export const ExecutionPanel = ({ logs, expanded = true, onToggle }: Props) => {
  const latestLogs = useMemo(() => logs.slice(-80), [logs]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (expanded && latestLogs.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [expanded, latestLogs.length]);

  return (
    <YStack
      backgroundColor={colors.bg.secondary}
      borderTopWidth={1}
      borderColor={colors.border.subtle}
    >
      <Pressable onPress={onToggle}>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$2.5"
        >
          <XStack alignItems="center" gap="$2">
            <Text color={colors.text.primary} fontSize={13} fontWeight="600">
              Console
            </Text>
            <XStack
              backgroundColor={colors.bg.elevated}
              paddingHorizontal="$2"
              paddingVertical="$0.5"
              borderRadius="$10"
            >
              <Text color={colors.text.muted} fontSize={10} fontFamily="$mono">
                {latestLogs.length}
              </Text>
            </XStack>
          </XStack>
          <Text color={colors.text.muted} fontSize={11}>
            {expanded ? "Collapse" : "Expand"}
          </Text>
        </XStack>
      </Pressable>

      {expanded ? (
        <ScrollView
          ref={scrollRef}
          style={{ maxHeight: 200 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {latestLogs.length === 0 ? (
            <Text color={colors.text.muted} fontSize={12} fontFamily="$mono" paddingVertical="$3">
              Awaiting agent activity...
            </Text>
          ) : (
            latestLogs.map((log) => <LogLine key={log.id} log={log} />)
          )}
        </ScrollView>
      ) : null}
    </YStack>
  );
};
