import { useState, useRef, useEffect, useCallback } from "react";
import { Pressable, View, StyleSheet, Animated, Easing, LayoutAnimation, Platform, UIManager } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { MessageCircle, Zap, ClipboardList, X, Check, ChevronDown as ChevronDownIcon } from "@tamagui/lucide-icons";
import type { ExecutionLog } from "../types/gateway";
import { useTheme } from "../theme/theme-context";
import type { ColorPalette } from "../theme/colors";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  logs: ExecutionLog[];
};

const NODE_ICON_SIZE = 12;

const NodeIcon = ({ level, color }: { level: string; color: string }) => {
  switch (level) {
    case "thought": return <MessageCircle size={NODE_ICON_SIZE} color={color} />;
    case "action": return <Zap size={NODE_ICON_SIZE} color={color} />;
    case "observation": return <ClipboardList size={NODE_ICON_SIZE} color={color} />;
    case "error": return <X size={NODE_ICON_SIZE} color={color} />;
    case "done": return <Check size={NODE_ICON_SIZE} color={color} />;
    default: return <Check size={NODE_ICON_SIZE} color={color} />;
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

const ExpandChevron = ({ color, expanded }: { color: string; expanded: boolean }) => (
  <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}>
    <ChevronDownIcon size={12} color={color} />
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
                <ExpandChevron color={colors.text.muted} expanded={detailExpanded} />
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
            <X size={14} color={headerIconColor} />
          ) : (
            <Check size={14} color={headerIconColor} />
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

          <ExpandChevron color={colors.text.muted} expanded={!collapsed} />
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
