import { memo, useMemo } from "react";
import { FlatList, Pressable } from "react-native";
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

const CommandRow = memo(
  ({ item, onSelect }: { item: SlashCommand; onSelect: (cmd: SlashCommand) => void }) => {
    const { colors } = useTheme();
    const CATEGORY_COLORS: Record<string, string> = {
      openclaw: colors.accent.cyan,
      custom: colors.accent.purple,
    };
    return (
    <Pressable onPress={() => onSelect(item)}>
      {({ pressed }) => (
        <XStack
          paddingHorizontal="$3.5"
          paddingVertical="$2.5"
          gap="$2.5"
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
            color={colors.accent.blue}
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
            <Text color={colors.text.muted} fontSize={10}>
              ⏎
            </Text>
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
    openclaw: colors.accent.cyan,
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
            <XStack paddingHorizontal="$3.5" paddingVertical="$1.5">
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
