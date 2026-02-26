import { memo, useMemo } from "react";
import { FlatList, Pressable, View, StyleSheet } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useTheme } from "../theme/theme-context";
import type { SlashCommand } from "../data/slash-commands";
import { SLASH_COMMANDS } from "../data/slash-commands";

type Props = {
  filter: string;
  onSelect: (cmd: SlashCommand) => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  openclaw: "OpenClaw",
  custom: "Custom",
};

const ReturnIcon = ({ color }: { color: string }) => (
  <View style={{ width: 12, height: 12, alignItems: "center", justifyContent: "center" }}>
    <View style={{ width: 8, height: 5, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: color, borderBottomLeftRadius: 2 }} />
    <View style={{ width: 4, height: 4, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: color, transform: [{ rotate: "-45deg" }], position: "absolute", left: 0, bottom: 1 }} />
  </View>
);

const CommandRow = memo(
  ({ item, onSelect }: { item: SlashCommand; onSelect: (cmd: SlashCommand) => void }) => {
    const { colors } = useTheme();
    const CATEGORY_COLORS: Record<string, string> = {
      openclaw: colors.brand.blue,
      custom: colors.accent.purple,
    };
    return (
    <Pressable onPress={() => onSelect(item)}>
      {({ pressed }) => (
        <XStack
          paddingHorizontal={14}
          paddingVertical={10}
          gap={10}
          alignItems="center"
          backgroundColor={pressed ? colors.bg.elevated : "transparent"}
        >
          <YStack
            width={6}
            height={6}
            borderRadius={3}
            backgroundColor={CATEGORY_COLORS[item.category] ?? colors.text.muted}
          />
          <Text
            color={colors.brand.blue}
            fontSize={14}
            fontWeight="600"
            fontFamily="$mono"
            flexShrink={0}
          >
            {item.command}
          </Text>
          <Text
            color={colors.text.secondary}
            fontSize={13}
            numberOfLines={1}
            flex={1}
          >
            {item.description}
          </Text>
          {item.immediate && (
            <ReturnIcon color={colors.text.muted} />
          )}
        </XStack>
      )}
    </Pressable>
    );
  }
);

export const SlashCommandPanel = memo(({ filter, onSelect }: Props) => {
  const { colors } = useTheme();
  const CATEGORY_COLORS: Record<string, string> = {
    openclaw: colors.brand.blue,
    custom: colors.accent.purple,
  };
  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (c) =>
        c.command.toLowerCase().includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [filter]);

  const grouped = useMemo(() => {
    const groups: { category: string; data: SlashCommand[] }[] = [];
    const map = new Map<string, SlashCommand[]>();
    for (const cmd of filtered) {
      const arr = map.get(cmd.category) ?? [];
      arr.push(cmd);
      map.set(cmd.category, arr);
    }
    for (const [category, data] of map) {
      groups.push({ category, data });
    }
    return groups;
  }, [filtered]);

  if (filtered.length === 0) return null;

  return (
    <YStack
      backgroundColor={colors.bg.secondary}
      borderTopWidth={1}
      borderColor={colors.border.subtle}
      maxHeight={260}
    >
      <FlatList
        data={grouped}
        keyExtractor={(g) => g.category}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: group }) => (
          <YStack>
            <XStack paddingHorizontal={14} paddingVertical={6}>
              <Text
                color={CATEGORY_COLORS[group.category] ?? colors.text.muted}
                fontSize={11}
                fontWeight="700"
                textTransform="uppercase"
                letterSpacing={0.8}
              >
                {CATEGORY_LABELS[group.category] ?? group.category}
              </Text>
            </XStack>
            {group.data.map((cmd) => (
              <CommandRow key={cmd.id} item={cmd} onSelect={onSelect} />
            ))}
          </YStack>
        )}
      />
    </YStack>
  );
});
