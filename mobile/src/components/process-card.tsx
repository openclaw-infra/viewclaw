import { useState, useRef, useEffect, useCallback } from "react";
import { Pressable, View, StyleSheet, Animated, Easing, LayoutAnimation, Platform, UIManager } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import type { ExecutionLog } from "../types/gateway";
import { useTheme } from "../theme/theme-context";
import type { ColorPalette } from "../theme/colors";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  logs: ExecutionLog[];
};

const ThoughtIcon = ({ color, size = 14 }: { color: string; size?: number }) => (
  <View style={[iconStyles.wrap, { width: size, height: size }]}>
    <View style={[iconStyles.bubble, { borderColor: color }]} />
    <View style={[iconStyles.bubbleDot, { backgroundColor: color, bottom: 0, left: 2 }]} />
  </View>
);

const BoltIcon = ({ color, size = 14 }: { color: string; size?: number }) => (
  <View style={[iconStyles.wrap, { width: size, height: size }]}>
    <View style={[iconStyles.bolt, { borderLeftColor: color }]} />
    <View style={[iconStyles.boltLower, { borderLeftColor: color }]} />
  </View>
);

const ClipboardIcon = ({ color, size = 14 }: { color: string; size?: number }) => (
  <View style={[iconStyles.wrap, { width: size, height: size }]}>
    <View style={[iconStyles.clipboard, { borderColor: color }]} />
    <View style={[iconStyles.clipTop, { backgroundColor: color }]} />
  </View>
);

const CrossIcon = ({ color, size = 14 }: { color: string; size?: number }) => (
  <View style={[iconStyles.wrap, { width: size, height: size, alignItems: "center", justifyContent: "center" }]}>
    <View style={[iconStyles.crossLine1, { backgroundColor: color }]} />
    <View style={[iconStyles.crossLine2, { backgroundColor: color }]} />
  </View>
);

const CheckIcon = ({ color, size = 14 }: { color: string; size?: number }) => (
  <View style={[iconStyles.wrap, { width: size, height: size, alignItems: "center", justifyContent: "center" }]}>
    <View style={[iconStyles.check, { borderBottomColor: color, borderLeftColor: color }]} />
  </View>
);

const iconStyles = StyleSheet.create({
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
});

const NodeIcon = ({ level, color }: { level: string; color: string }) => {
  switch (level) {
    case "thought": return <ThoughtIcon color={color} />;
    case "action": return <BoltIcon color={color} />;
    case "observation": return <ClipboardIcon color={color} />;
    case "error": return <CrossIcon color={color} />;
    case "done": return <CheckIcon color={color} />;
    default: return <CheckIcon color={color} />;
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

const getNodeMeta = (colors: ColorPalette, t: (key: string) => string) => ({
  thought: { label: t("process.thinking"), color: colors.log.thought },
  action: { label: t("process.toolCall"), color: colors.log.action },
  observation: { label: t("process.result"), color: colors.log.observation },
  error: { label: t("process.error"), color: colors.log.error },
  done: { label: t("process.completed"), color: colors.log.done },
  status: { label: t("process.status"), color: colors.log.status },
});

type OverallStatus = "running" | "success" | "error";

const getOverallStatus = (logs: ExecutionLog[]): OverallStatus => {
  if (logs.some((l) => l.level === "error")) return "error";
  if (logs.some((l) => l.level === "done")) return "success";
  return "running";
};

const getHeaderInfo = (logs: ExecutionLog[], colors: ColorPalette, t: (key: string) => string): { label: string; color: string } => {
  const status = getOverallStatus(logs);
  if (status === "error") return { label: t("process.executionError"), color: colors.log.error };
  if (status === "success") return { label: t("process.executionComplete"), color: colors.log.done };
  const lastLog = logs[logs.length - 1];
  if (lastLog?.level === "action") {
    return { label: lastLog.toolName ?? t("process.executing"), color: colors.state.running };
  }
  if (lastLog?.level === "thought") {
    return { label: t("process.thinkingEllipsis"), color: colors.log.thought };
  }
  return { label: t("process.executing"), color: colors.state.running };
};

const ChevronDown = ({ color, expanded }: { color: string; expanded: boolean }) => (
  <View style={{ width: 12, height: 12, alignItems: "center", justifyContent: "center" }}>
    <View
      style={{
        width: 6,
        height: 6,
        borderBottomWidth: 1.5,
        borderRightWidth: 1.5,
        borderColor: color,
        transform: [{ rotate: expanded ? "225deg" : "45deg" }],
        marginTop: expanded ? 2 : -2,
      }}
    />
  </View>
);

const TimelineNode = ({
  log,
  isLast,
  isRunning,
  colors,
  nodeMeta,
}: {
  log: ExecutionLog;
  isLast: boolean;
  isRunning: boolean;
  colors: ColorPalette;
  nodeMeta: ReturnType<typeof getNodeMeta>;
}) => {
  const [detailExpanded, setDetailExpanded] = useState(false);
  const meta = nodeMeta[log.level];
  const hasDetail = !!log.detail;
  const nodeIsRunning = isRunning && isLast && log.level === "action" && !log.detail;

  const toggleDetail = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDetailExpanded((p) => !p);
  }, []);

  return (
    <XStack gap={10}>
      {/* Timeline column: dot + line */}
      <YStack alignItems="center" width={20}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: meta.color + "20",
              borderColor: meta.color,
            },
          ]}
        >
          <View style={{ transform: [{ scale: 0.7 }] }}>
            <NodeIcon level={log.level} color={meta.color} />
          </View>
        </View>
        {!isLast && (
          <View
            style={[
              styles.line,
              { backgroundColor: colors.border.subtle },
            ]}
          />
        )}
      </YStack>

      {/* Content column */}
      <YStack flex={1} paddingBottom={isLast ? 0 : 12} gap={3}>
        <Pressable onPress={hasDetail ? toggleDetail : undefined}>
          <XStack alignItems="center" gap={6}>
            <Text
              color={meta.color}
              fontSize={11}
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing={0.5}
            >
              {log.toolName ?? meta.label}
            </Text>
            {nodeIsRunning && (
              <XStack gap={3} alignItems="center">
                <SpinnerDot color={meta.color} />
                <SpinnerDot color={meta.color} />
                <SpinnerDot color={meta.color} />
              </XStack>
            )}
            {hasDetail && (
              <XStack marginLeft="auto">
                <ChevronDown color={colors.text.muted} expanded={detailExpanded} />
              </XStack>
            )}
          </XStack>
        </Pressable>

        <Text
          color={colors.text.secondary}
          fontSize={12}
          fontFamily="$mono"
          numberOfLines={detailExpanded ? undefined : 2}
          lineHeight={17}
        >
          {log.text}
        </Text>

        {detailExpanded && log.detail ? (
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
              numberOfLines={16}
              lineHeight={16}
            >
              {log.detail}
            </Text>
          </YStack>
        ) : null}
      </YStack>
    </XStack>
  );
};

export const ProcessCard = ({ logs }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const nodeMeta = getNodeMeta(colors, t);
  const overallStatus = getOverallStatus(logs);
  const headerInfo = getHeaderInfo(logs, colors, t);
  const isRunning = overallStatus === "running";

  const visibleLogs = logs.filter((l) => l.level !== "status" && l.level !== "done");
  const stepCount = visibleLogs.length;

  const autoCollapsed = useRef(false);
  useEffect(() => {
    if ((overallStatus === "success" || overallStatus === "error") && !autoCollapsed.current) {
      autoCollapsed.current = true;
      const timer = setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsed(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [overallStatus]);

  const toggleCollapse = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((p) => !p);
  }, []);

  const headerIconColor = headerInfo.color;

  return (
    <YStack
      marginHorizontal={12}
      marginBottom={6}
      borderRadius={16}
      backgroundColor={colors.bg.secondary}
      borderWidth={1}
      borderColor={
        isRunning
          ? colors.brand.blue + "40"
          : overallStatus === "error"
            ? colors.log.error + "30"
            : colors.border.subtle
      }
      overflow="hidden"
    >
      {/* Header */}
      <Pressable onPress={toggleCollapse}>
        <XStack
          paddingHorizontal={14}
          paddingVertical={10}
          alignItems="center"
          gap={8}
          backgroundColor={
            isRunning
              ? colors.brand.blue + "08"
              : overallStatus === "error"
                ? colors.log.error + "08"
                : "transparent"
          }
        >
          {isRunning ? (
            <XStack gap={3} alignItems="center" width={14} justifyContent="center">
              <SpinnerDot color={headerIconColor} />
              <SpinnerDot color={headerIconColor} />
            </XStack>
          ) : overallStatus === "error" ? (
            <CrossIcon color={headerIconColor} />
          ) : (
            <CheckIcon color={headerIconColor} />
          )}

          <Text
            color={headerInfo.color}
            fontSize={13}
            fontWeight="600"
            flex={1}
            numberOfLines={1}
          >
            {headerInfo.label}
          </Text>

          {collapsed && stepCount > 0 && (
            <Text color={colors.text.muted} fontSize={11}>
              {t("process.steps", { count: stepCount })}
            </Text>
          )}

          <ChevronDown color={colors.text.muted} expanded={!collapsed} />
        </XStack>
      </Pressable>

      {/* Timeline body */}
      {!collapsed && visibleLogs.length > 0 && (
        <YStack
          paddingHorizontal={14}
          paddingTop={4}
          paddingBottom={12}
          borderTopWidth={1}
          borderTopColor={colors.border.subtle + "60"}
        >
          {visibleLogs.map((log, idx) => (
            <TimelineNode
              key={log.id}
              log={log}
              isLast={idx === visibleLogs.length - 1}
              isRunning={isRunning}
              colors={colors}
              nodeMeta={nodeMeta}
            />
          ))}
        </YStack>
      )}
    </YStack>
  );
};

const styles = StyleSheet.create({
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    width: 1.5,
    flex: 1,
    minHeight: 12,
    borderRadius: 1,
  },
});
