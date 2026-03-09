import { useEffect } from "react";
import { Pressable, View, StyleSheet, Image } from "react-native";
import Reanimated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing as REasing, cancelAnimation } from "react-native-reanimated";
import { Text, XStack, YStack, AnimatePresence } from "tamagui";
import { Settings, ChevronDown as ChevronDownIcon } from "@tamagui/lucide-icons";
import type { ConnectionStatus, SessionContext } from "../types/gateway";
import { useTheme } from "../theme/theme-context";

const logoIcon = require("../../assets/logo-icon.png");

type Props = {
  sessionId: string;
  sessionTitle?: string;
  agentId?: string;
  queuedCount?: number;
  status: ConnectionStatus;
  sessionCount?: number;
  gatewayLabel?: string;
  context?: SessionContext | null;
  onSessionPress?: () => void;
  onGatewayPress?: () => void;
  onSettingsPress?: () => void;
};

const ctxStyles = StyleSheet.create({
  bar: { width: 32, height: 3, borderRadius: 1.5, overflow: "hidden" },
  barFill: { height: 3, borderRadius: 1.5 },
});

const StatusDot = ({ color, pulsing }: { color: string; pulsing: boolean }) => {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (pulsing) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 800, easing: REasing.inOut(REasing.ease) }),
          withTiming(1, { duration: 800, easing: REasing.inOut(REasing.ease) }),
        ),
        -1,
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800, easing: REasing.inOut(REasing.ease) }),
          withTiming(1, { duration: 800, easing: REasing.inOut(REasing.ease) }),
        ),
        -1,
      );
    } else {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [pulsing]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View
      style={[
        { width: 8, height: 8, borderRadius: 4, backgroundColor: color },
        animStyle,
      ]}
    />
  );
};

const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export const ChatHeader = ({
  sessionId,
  sessionTitle,
  agentId,
  queuedCount,
  status,
  sessionCount,
  gatewayLabel,
  context,
  onSessionPress,
  onGatewayPress,
  onSettingsPress,
}: Props) => {
  const { colors } = useTheme();
  const statusColor = colors.status[status];
  const isPending = sessionId.startsWith("pending-");
  const shortId = sessionId && !isPending ? sessionId.slice(0, 8) : "---";

  const showInfo = !isPending;

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal={16}
      paddingVertical={12}
      borderBottomWidth={1}
      borderColor={colors.border.subtle}
    >
      <YStack gap={4} flex={1} overflow="hidden">
        <XStack alignItems="center" gap={6}>
          <Image source={logoIcon} style={{ width: 26, height: 26 }} resizeMode="contain" />
          <Text color={colors.brand.blue} fontSize={20} fontWeight="800" letterSpacing={-0.5}>
            Claw
          </Text>
          <Text color={colors.brand.purple} fontSize={20} fontWeight="800" letterSpacing={-0.5} marginLeft={-6}>
            Flow
          </Text>
        </XStack>
        <XStack alignItems="center" gap={6}>
          <Pressable onPress={onSessionPress} style={{ flexShrink: 1 }}>
            <XStack alignItems="center" gap={6} flexShrink={1}>
              <AnimatePresence>
                {showInfo && (
                  <YStack
                    key="session-info"
                    animation="lazy"
                    enterStyle={{ opacity: 0 }}
                    exitStyle={{ opacity: 0 }}
                    flexShrink={1}
                  >
                    {sessionTitle ? (
                      <Text
                        color={colors.text.secondary}
                        fontSize={12}
                        fontWeight="500"
                        numberOfLines={1}
                      >
                        {sessionTitle}
                      </Text>
                    ) : !isPending ? (
                      <Text color={colors.text.muted} fontSize={12} fontFamily="$mono">
                        {shortId}
                      </Text>
                    ) : null}
                  </YStack>
                )}
              </AnimatePresence>
              {agentId && (
                <YStack
                  backgroundColor={colors.brand.blue + "18"}
                  paddingHorizontal={6}
                  paddingVertical={1}
                  borderRadius={4}
                  flexShrink={0}
                >
                  <Text color={colors.brand.blue} fontSize={10} fontWeight="600">
                    {agentId}
                  </Text>
                </YStack>
              )}
              {sessionCount != null && sessionCount > 0 && (
                <YStack
                  backgroundColor={colors.bg.elevated}
                  paddingHorizontal={6}
                  paddingVertical={1}
                  borderRadius={4}
                  flexShrink={0}
                >
                  <Text color={colors.text.muted} fontSize={10} fontWeight="600">
                    {sessionCount}
                  </Text>
                </YStack>
              )}
              {queuedCount != null && queuedCount > 0 && (
                <YStack
                  backgroundColor={colors.accent.yellow + "20"}
                  borderWidth={1}
                  borderColor={colors.accent.yellow + "40"}
                  paddingHorizontal={8}
                  paddingVertical={2}
                  borderRadius={999}
                  flexShrink={0}
                >
                  <Text color={colors.accent.yellow} fontSize={10} fontWeight="700">
                    Queue {queuedCount}
                  </Text>
                </YStack>
              )}
              <ChevronDownIcon size={10} color={colors.text.muted} />
            </XStack>
          </Pressable>
          <AnimatePresence>
            {context && showInfo && (
              <YStack
                key="context-bar"
                animation="lazy"
                enterStyle={{ opacity: 0 }}
                exitStyle={{ opacity: 0 }}
                flexShrink={0}
              >
                <XStack alignItems="center" gap={4} marginLeft={2}>
                  <Text color={colors.text.muted} fontSize={10} opacity={0.5}>·</Text>
                  <View style={[ctxStyles.bar, { backgroundColor: colors.bg.tertiary }]}>
                    <YStack
                      animation="lazy"
                      style={[
                        ctxStyles.barFill,
                        {
                          backgroundColor:
                            context.percent > 85 ? colors.accent.red :
                            context.percent > 65 ? colors.accent.yellow :
                            colors.brand.blue,
                          width: `${Math.min(context.percent, 100)}%` as any,
                        },
                      ]}
                    />
                  </View>
                  <Text color={colors.text.muted} fontSize={10} fontFamily="$mono">
                    {formatTokens(context.usedTokens)}/{formatTokens(context.maxTokens)}
                  </Text>
                </XStack>
              </YStack>
            )}
          </AnimatePresence>
        </XStack>
      </YStack>

      <XStack alignItems="center" gap={8} flexShrink={0}>
        <Pressable onPress={onGatewayPress} hitSlop={8}>
          <XStack alignItems="center" gap={5}>
            <StatusDot color={statusColor} pulsing={status === "connecting"} />
            {gatewayLabel && (
              <Text color={colors.text.muted} fontSize={11}>
                {gatewayLabel}
              </Text>
            )}
          </XStack>
        </Pressable>
        <Pressable onPress={onSettingsPress} hitSlop={4}>
          <YStack
            width={32}
            height={32}
            borderRadius={16}
            backgroundColor={colors.bg.tertiary}
            alignItems="center"
            justifyContent="center"
          >
            <Settings size={16} color={colors.text.secondary} />
          </YStack>
        </Pressable>
      </XStack>
    </XStack>
  );
};
