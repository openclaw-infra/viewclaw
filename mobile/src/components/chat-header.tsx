import { useEffect, useRef } from "react";
import { Pressable, View, StyleSheet, Image, Animated } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { Settings, ChevronDown as ChevronDownIcon } from "@tamagui/lucide-icons";
import type { ConnectionStatus, SessionContext } from "../types/gateway";
import { useTheme } from "../theme/theme-context";

const logoIcon = require("../../assets/logo-icon.png");

type Props = {
  sessionId: string;
  sessionTitle?: string;
  agentId?: string;
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

const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export const ChatHeader = ({
  sessionId,
  sessionTitle,
  agentId,
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
  const infoAnim = useRef(new Animated.Value(showInfo ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(infoAnim, {
      toValue: showInfo ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [showInfo, infoAnim]);

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal={16}
      paddingVertical={12}
      borderBottomWidth={1}
      borderColor={colors.border.subtle}
    >
      <YStack gap={4}>
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
          <Pressable onPress={onSessionPress}>
            <XStack alignItems="center" gap={6}>
              <Animated.View style={{ opacity: infoAnim }}>
                {sessionTitle ? (
                  <Text
                    color={colors.text.secondary}
                    fontSize={12}
                    fontWeight="500"
                    numberOfLines={1}
                    maxWidth={160}
                  >
                    {sessionTitle}
                  </Text>
                ) : !isPending ? (
                  <Text color={colors.text.muted} fontSize={12} fontFamily="$mono">
                    {shortId}
                  </Text>
                ) : null}
              </Animated.View>
              {agentId && (
                <YStack
                  backgroundColor={colors.brand.blue + "18"}
                  paddingHorizontal={6}
                  paddingVertical={1}
                  borderRadius={4}
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
                >
                  <Text color={colors.text.muted} fontSize={10} fontWeight="600">
                    {sessionCount}
                  </Text>
                </YStack>
              )}
              <ChevronDownIcon size={10} color={colors.text.muted} />
            </XStack>
          </Pressable>
          {context && (
            <Animated.View style={{ opacity: infoAnim }}>
              <XStack alignItems="center" gap={4} marginLeft={2}>
                <Text color={colors.text.muted} fontSize={10} opacity={0.5}>·</Text>
                <View style={[ctxStyles.bar, { backgroundColor: colors.bg.tertiary }]}>
                  <View
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
            </Animated.View>
          )}
        </XStack>
      </YStack>

      <XStack alignItems="center" gap={8}>
        <Pressable onPress={onGatewayPress} hitSlop={8}>
          <XStack alignItems="center" gap={5}>
            <YStack
              width={8}
              height={8}
              borderRadius={4}
              backgroundColor={statusColor}
            />
            {gatewayLabel && (
              <Text color={colors.text.muted} fontSize={11}>
                {gatewayLabel}
              </Text>
            )}
          </XStack>
        </Pressable>
        <Pressable onPress={onSettingsPress}>
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
