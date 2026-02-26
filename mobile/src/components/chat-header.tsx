import { Pressable, View, StyleSheet, Image } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import type { ConnectionStatus } from "../types/gateway";
import { useTheme } from "../theme/theme-context";

const logoIcon = require("../../assets/logo-icon.png");

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

const SettingsIcon = ({ color, size = 16 }: { color: string; size?: number }) => {
  const toothW = 2.4;
  const toothH = 3.2;
  const cx = size / 2;
  const cy = size / 2;
  const dist = 5.2;
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <View style={{ width: size, height: size }}>
      {teeth.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <View
            key={deg}
            style={{
              position: "absolute",
              width: toothW,
              height: toothH,
              borderRadius: 1,
              backgroundColor: color,
              left: cx - toothW / 2 + Math.cos(rad) * dist,
              top: cy - toothH / 2 + Math.sin(rad) * dist,
              transform: [{ rotate: `${deg}deg` }],
            }}
          />
        );
      })}
      <View
        style={{
          position: "absolute",
          width: 8,
          height: 8,
          borderRadius: 4,
          borderWidth: 1.6,
          borderColor: color,
          left: cx - 4,
          top: cy - 4,
        }}
      />
    </View>
  );
};

const AgentIcon = ({ color, size = 12 }: { color: string; size?: number }) => (
  <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <View style={[iconStyles.agentHead, { backgroundColor: color }]} />
    <View style={[iconStyles.agentBody, { backgroundColor: color }]} />
  </View>
);

const ChevronDown = ({ color, size = 8 }: { color: string; size?: number }) => (
  <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <View style={[iconStyles.chevron, { borderBottomColor: color, borderRightColor: color }]} />
  </View>
);

const iconStyles = StyleSheet.create({
  agentHead: { width: 6, height: 6, borderRadius: 3, marginBottom: 1 },
  agentBody: { width: 10, height: 4, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  chevron: { width: 5, height: 5, borderBottomWidth: 1.5, borderRightWidth: 1.5, transform: [{ rotate: "45deg" }], marginTop: -2 },
});

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
          {agentId && (
            <Pressable onPress={onAgentPress}>
              <XStack
                alignItems="center"
                gap={4}
                backgroundColor={colors.brand.purple + "14"}
                paddingHorizontal={8}
                paddingVertical={4}
                borderRadius={6}
                borderWidth={1}
                borderColor={colors.brand.purple + "28"}
              >
                <AgentIcon color={colors.brand.purple} />
                <Text color={colors.brand.purple} fontSize={11} fontWeight="600">
                  {agentId}
                </Text>
                <ChevronDown color={colors.brand.purple} />
              </XStack>
            </Pressable>
          )}
        </XStack>
        <Pressable onPress={onSessionPress}>
          <XStack alignItems="center" gap={6}>
            <Text color={colors.text.muted} fontSize={12} fontFamily="$mono">
              {shortId}
            </Text>
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
            <ChevronDown color={colors.text.muted} />
          </XStack>
        </Pressable>
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
            <SettingsIcon color={colors.text.secondary} />
          </YStack>
        </Pressable>
      </XStack>
    </XStack>
  );
};
