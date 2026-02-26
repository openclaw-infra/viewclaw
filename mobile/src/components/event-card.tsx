import { useState, useRef, useEffect } from "react";
import { Pressable, View, StyleSheet, Animated, Easing } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import type { ExecutionLog } from "../types/gateway";
import { useTheme } from "../theme/theme-context";
import type { ColorPalette } from "../theme/colors";

type Props = {
  log: ExecutionLog;
};

const ThoughtIcon = ({ color }: { color: string }) => (
  <View style={nodeIconStyles.wrap}>
    <View style={[nodeIconStyles.bubble, { borderColor: color }]} />
    <View style={[nodeIconStyles.bubbleDot, { backgroundColor: color, bottom: 0, left: 2 }]} />
  </View>
);

const BoltIcon = ({ color }: { color: string }) => (
  <View style={nodeIconStyles.wrap}>
    <View style={[nodeIconStyles.bolt, { borderLeftColor: color }]} />
    <View style={[nodeIconStyles.boltLower, { borderLeftColor: color }]} />
  </View>
);

const ClipboardIcon = ({ color }: { color: string }) => (
  <View style={nodeIconStyles.wrap}>
    <View style={[nodeIconStyles.clipboard, { borderColor: color }]} />
    <View style={[nodeIconStyles.clipTop, { backgroundColor: color }]} />
  </View>
);

const CrossIcon = ({ color }: { color: string }) => (
  <View style={[nodeIconStyles.wrap, { alignItems: "center", justifyContent: "center" }]}>
    <View style={[nodeIconStyles.crossLine1, { backgroundColor: color }]} />
    <View style={[nodeIconStyles.crossLine2, { backgroundColor: color }]} />
  </View>
);

const CheckIcon = ({ color }: { color: string }) => (
  <View style={[nodeIconStyles.wrap, { alignItems: "center", justifyContent: "center" }]}>
    <View style={[nodeIconStyles.check, { borderBottomColor: color, borderLeftColor: color }]} />
  </View>
);

const DotIcon = ({ color }: { color: string }) => (
  <View style={[nodeIconStyles.wrap, { alignItems: "center", justifyContent: "center" }]}>
    <View style={[nodeIconStyles.dot, { backgroundColor: color }]} />
  </View>
);

const nodeIconStyles = StyleSheet.create({
  wrap: { width: 14, height: 14, position: "relative" },
  bubble: { width: 10, height: 8, borderWidth: 1.5, borderRadius: 4, position: "absolute", top: 1, left: 2 },
  bubbleDot: { width: 2.5, height: 2.5, borderRadius: 1.25, position: "absolute" },
  bolt: { width: 0, height: 0, borderLeftWidth: 5, borderTopWidth: 0, borderBottomWidth: 7, borderLeftColor: "transparent", borderTopColor: "transparent", borderBottomColor: "transparent", position: "absolute", top: 0, left: 5 },
  boltLower: { width: 0, height: 0, borderLeftWidth: 5, borderTopWidth: 7, borderBottomWidth: 0, borderLeftColor: "transparent", borderTopColor: "transparent", position: "absolute", top: 6, left: 3 },
  clipboard: { width: 9, height: 11, borderWidth: 1.5, borderRadius: 2, position: "absolute", bottom: 0, left: 2.5 },
  clipTop: { width: 5, height: 2, borderRadius: 1, position: "absolute", top: 1, left: 4.5 },
  crossLine1: { width: 10, height: 1.5, borderRadius: 1, position: "absolute", transform: [{ rotate: "45deg" }] },
  crossLine2: { width: 10, height: 1.5, borderRadius: 1, position: "absolute", transform: [{ rotate: "-45deg" }] },
  check: { width: 7, height: 4, borderBottomWidth: 1.8, borderLeftWidth: 1.8, borderBottomColor: "transparent", borderLeftColor: "transparent", transform: [{ rotate: "-45deg" }], marginTop: -2 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});

const NodeIcon = ({ level, color }: { level: string; color: string }) => {
  switch (level) {
    case "thought": return <ThoughtIcon color={color} />;
    case "action": return <BoltIcon color={color} />;
    case "observation": return <ClipboardIcon color={color} />;
    case "error": return <CrossIcon color={color} />;
    case "done": return <CheckIcon color={color} />;
    default: return <DotIcon color={color} />;
  }
};

const SpinnerDot = ({ color }: { color: string }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return (
    <Animated.View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: color, opacity }} />
  );
};

const getMeta = (colors: ColorPalette) => ({
  thought: {
    label: "Thinking",
    color: colors.log.thought,
    bg: colors.log.thought + "0F",
    borderTint: colors.log.thought + "25",
  },
  action: {
    label: "Tool Call",
    color: colors.log.action,
    bg: colors.log.action + "0F",
    borderTint: colors.log.action + "25",
  },
  observation: {
    label: "Result",
    color: colors.log.observation,
    bg: colors.log.observation + "0F",
    borderTint: colors.log.observation + "25",
  },
  error: {
    label: "Error",
    color: colors.log.error,
    bg: colors.log.error + "12",
    borderTint: colors.log.error + "30",
  },
  done: {
    label: "Completed",
    color: colors.log.done,
    bg: colors.log.done + "0F",
    borderTint: colors.log.done + "25",
  },
  status: {
    label: "System",
    color: colors.log.status,
    bg: colors.log.status + "0F",
    borderTint: colors.log.status + "20",
  },
});

const ChevronRight = ({ color, expanded }: { color: string; expanded: boolean }) => (
  <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
    <View
      style={{
        width: 5,
        height: 5,
        borderBottomWidth: 1.5,
        borderRightWidth: 1.5,
        borderColor: color,
        transform: [{ rotate: expanded ? "45deg" : "0deg" }],
        marginTop: expanded ? -2 : 0,
      }}
    />
  </View>
);

export const EventCard = ({ log }: Props) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const meta = getMeta(colors)[log.level];
  const hasDetail = !!log.detail;
  const isRunning = log.level === "action" && !log.detail;

  return (
    <Pressable onPress={hasDetail ? () => setExpanded((p) => !p) : undefined}>
      <XStack
        marginHorizontal={12}
        marginBottom={6}
        borderRadius={12}
        backgroundColor={meta.bg}
        borderWidth={1}
        borderColor={meta.borderTint}
        overflow="hidden"
      >
        <YStack width={3} backgroundColor={meta.color} borderTopLeftRadius={12} borderBottomLeftRadius={12} />

        <YStack flex={1} paddingHorizontal={10} paddingVertical={8} gap={4}>
          <XStack alignItems="center" gap={6}>
            <NodeIcon level={log.level} color={meta.color} />
            <Text
              color={meta.color}
              fontSize={11}
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing={0.6}
            >
              {log.toolName ?? meta.label}
            </Text>
            {isRunning && (
              <XStack gap={3} marginLeft={4} alignItems="center">
                <SpinnerDot color={meta.color} />
                <SpinnerDot color={meta.color} />
                <SpinnerDot color={meta.color} />
              </XStack>
            )}
            {hasDetail && (
              <XStack marginLeft="auto">
                <ChevronRight color={colors.text.muted} expanded={expanded} />
              </XStack>
            )}
          </XStack>

          <Text
            color={colors.text.secondary}
            fontSize={12}
            fontFamily="$mono"
            numberOfLines={expanded ? undefined : 2}
            lineHeight={18}
          >
            {log.text}
          </Text>

          {expanded && log.detail ? (
            <YStack
              marginTop={4}
              padding={8}
              backgroundColor={colors.bg.codeBlock + "80"}
              borderRadius={6}
              borderWidth={1}
              borderColor={colors.border.subtle}
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
