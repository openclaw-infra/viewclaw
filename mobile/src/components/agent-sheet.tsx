import { memo, useCallback, useState } from "react";
import { FlatList, Pressable, Modal, ActivityIndicator, View, StyleSheet } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useTheme } from "../theme/theme-context";
import type { AgentInfo } from "../types/gateway";

const AgentNodeIcon = ({ color, isMain }: { color: string; isMain: boolean }) => (
  <View style={agentIconStyles.wrap}>
    {isMain ? (
      <>
        <View style={[agentIconStyles.head, { backgroundColor: color }]} />
        <View style={[agentIconStyles.body, { backgroundColor: color }]} />
      </>
    ) : (
      <>
        <View style={[agentIconStyles.wrench1, { backgroundColor: color }]} />
        <View style={[agentIconStyles.wrench2, { backgroundColor: color }]} />
      </>
    )}
  </View>
);

const agentIconStyles = StyleSheet.create({
  wrap: { width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  head: { width: 7, height: 7, borderRadius: 3.5, marginBottom: 1 },
  body: { width: 11, height: 5, borderTopLeftRadius: 5.5, borderTopRightRadius: 5.5 },
  wrench1: { width: 10, height: 2, borderRadius: 1, position: "absolute", transform: [{ rotate: "45deg" }] },
  wrench2: { width: 10, height: 2, borderRadius: 1, position: "absolute", transform: [{ rotate: "-45deg" }] },
});

type Props = {
  visible: boolean;
  agents: AgentInfo[];
  activeAgentId: string;
  loading: boolean;
  onClose: () => void;
  onSelect: (agentId: string) => void;
  onRefresh: () => Promise<void>;
};

const InfoRow = memo(({ label, value }: { label: string; value: string }) => {
  const { colors } = useTheme();
  return (
    <XStack gap="$2" alignItems="flex-start">
      <Text
        color={colors.text.muted}
        fontSize={11}
        fontWeight="600"
        width={70}
        textTransform="uppercase"
        letterSpacing={0.3}
      >
        {label}
      </Text>
      <Text
        color={colors.text.secondary}
        fontSize={12}
        fontFamily="$mono"
        flex={1}
        numberOfLines={3}
      >
        {value}
      </Text>
    </XStack>
  );
});

const AgentRow = memo(
  ({
    item,
    isActive,
    onSelect,
  }: {
    item: AgentInfo;
    isActive: boolean;
    onSelect: (id: string) => void;
  }) => {
    const { colors } = useTheme();
    const [expanded, setExpanded] = useState(false);
    const hasDetails = !!(item.model || item.workspace || item.instructions);

    return (
      <Pressable onPress={() => onSelect(item.id)}>
        {({ pressed }) => (
          <YStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            gap="$2"
            backgroundColor={
              isActive
                ? colors.bg.elevated
                : pressed
                  ? colors.bg.tertiary
                  : "transparent"
            }
            borderLeftWidth={isActive ? 3 : 0}
            borderLeftColor={isActive ? colors.accent.purple : "transparent"}
          >
            <XStack alignItems="center" justifyContent="space-between">
              <XStack alignItems="center" gap="$2" flex={1}>
                <YStack
                  width={32}
                  height={32}
                  borderRadius={8}
                  backgroundColor={isActive ? colors.accent.purple + "20" : colors.bg.tertiary}
                  alignItems="center"
                  justifyContent="center"
                >
                  <AgentNodeIcon color={isActive ? colors.accent.purple : colors.text.muted} isMain={item.id === "main"} />
                </YStack>
                <YStack flex={1} gap="$0.5">
                  <XStack alignItems="center" gap="$2">
                    <Text
                      color={isActive ? colors.accent.purple : colors.text.primary}
                      fontSize={15}
                      fontWeight="600"
                      numberOfLines={1}
                      flexShrink={1}
                    >
                      {item.id}
                    </Text>
                    {isActive && (
                      <YStack
                        backgroundColor={colors.accent.purple}
                        paddingHorizontal="$1.5"
                        paddingVertical={1}
                        borderRadius={4}
                      >
                        <Text color="#FFFFFF" fontSize={9} fontWeight="700">
                          ACTIVE
                        </Text>
                      </YStack>
                    )}
                  </XStack>
                  <XStack gap="$2" alignItems="center">
                    <Text color={colors.text.muted} fontSize={11}>
                      {item.sessionCount} session{item.sessionCount !== 1 ? "s" : ""}
                    </Text>
                    {item.model && (
                      <YStack
                        backgroundColor={colors.bg.tertiary}
                        paddingHorizontal="$1.5"
                        paddingVertical={1}
                        borderRadius={4}
                      >
                        <Text color={colors.accent.cyan} fontSize={10} fontFamily="$mono">
                          {item.model}
                        </Text>
                      </YStack>
                    )}
                  </XStack>
                </YStack>
              </XStack>

              {hasDetails && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setExpanded((v) => !v);
                  }}
                  hitSlop={8}
                >
                  <YStack
                    paddingHorizontal="$2"
                    paddingVertical="$1.5"
                    borderRadius={6}
                    backgroundColor={colors.bg.tertiary}
                  >
                    <Text color={colors.text.secondary} fontSize={11}>
                      {expanded ? "Less" : "Info"}
                    </Text>
                  </YStack>
                </Pressable>
              )}
            </XStack>

            {expanded && hasDetails && (
              <YStack
                gap="$1.5"
                paddingTop="$1.5"
                paddingLeft={44}
                borderTopWidth={1}
                borderColor={colors.border.subtle}
                marginTop="$1"
              >
                {item.model && <InfoRow label="Model" value={item.model} />}
                {item.workspace && <InfoRow label="Workspace" value={item.workspace} />}
                {item.instructions && (
                  <InfoRow
                    label="Prompt"
                    value={
                      item.instructions.length > 200
                        ? item.instructions.slice(0, 200) + "..."
                        : item.instructions
                    }
                  />
                )}
              </YStack>
            )}
          </YStack>
        )}
      </Pressable>
    );
  },
);

export const AgentSheet = memo(
  ({
    visible,
    agents,
    activeAgentId,
    loading,
    onClose,
    onSelect,
    onRefresh,
  }: Props) => {
    const { colors } = useTheme();
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }, [onRefresh]);

    const handleSelect = useCallback(
      (id: string) => {
        onSelect(id);
        onClose();
      },
      [onSelect, onClose],
    );

    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
          onPress={onClose}
        >
          <Pressable
            style={{ flex: 1, marginTop: 100 }}
            onPress={(e) => e.stopPropagation?.()}
          >
            <YStack
              flex={1}
              backgroundColor={colors.bg.secondary}
              borderTopLeftRadius={24}
              borderTopRightRadius={24}
              overflow="hidden"
            >
              <YStack alignItems="center" paddingVertical={10}>
                <YStack
                  width={40}
                  height={4}
                  borderRadius={2}
                  backgroundColor={colors.border.medium}
                  opacity={0.6}
                />
              </YStack>

              <XStack
                alignItems="center"
                justifyContent="space-between"
                paddingHorizontal={16}
                paddingVertical={10}
              >
                <Text
                  color={colors.text.primary}
                  fontSize={20}
                  fontWeight="700"
                >
                  Agents
                </Text>
                <Pressable onPress={handleRefresh} disabled={refreshing}>
                  <YStack
                    paddingHorizontal={12}
                    paddingVertical={6}
                    borderRadius={12}
                    backgroundColor={colors.bg.tertiary}
                    borderWidth={1}
                    borderColor={colors.border.subtle}
                  >
                    <Text
                      color={refreshing ? colors.text.muted : colors.text.secondary}
                      fontSize={12}
                      fontWeight="600"
                    >
                      {refreshing ? "..." : "Refresh"}
                    </Text>
                  </YStack>
                </Pressable>
              </XStack>

              <XStack paddingHorizontal={16} paddingBottom={8}>
                <Text color={colors.text.muted} fontSize={12}>
                  {agents.length} agent{agents.length !== 1 ? "s" : ""} available
                </Text>
              </XStack>

              {/* List */}
              {loading && agents.length === 0 ? (
                <YStack
                  alignItems="center"
                  justifyContent="center"
                  paddingVertical="$10"
                  gap="$3"
                >
                  <ActivityIndicator color={colors.accent.purple} />
                  <Text color={colors.text.muted} fontSize={13}>
                    Loading agents...
                  </Text>
                </YStack>
              ) : (
                <FlatList
                  data={agents}
                  keyExtractor={(a) => a.id}
                  renderItem={({ item }) => (
                    <AgentRow
                      item={item}
                      isActive={item.id === activeAgentId}
                      onSelect={handleSelect}
                    />
                  )}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <YStack
                      alignItems="center"
                      justifyContent="center"
                      paddingVertical="$10"
                      gap="$2"
                    >
                      <Text color={colors.text.muted} fontSize={14}>
                        No agents found
                      </Text>
                      <Text color={colors.text.muted} fontSize={12}>
                        Make sure OpenClaw is running
                      </Text>
                    </YStack>
                  }
                />
              )}
            </YStack>
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);
