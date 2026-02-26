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
  <View style={iconStyles.returnWrap}>
    <View style={[iconStyles.returnArm, { borderColor: color }]} />
    <View style={[iconStyles.returnHead, { borderColor: color }]} />
  </View>
);

const iconStyles = StyleSheet.create({
  returnWrap: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  returnArm: { width: 9, height: 6, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 2.5 },
  returnHead: { width: 5, height: 5, borderTopWidth: 1.5, borderLeftWidth: 1.5, transform: [{ rotate: "-45deg" }], position: "absolute", left: 0, bottom: 1.5 },
});

const CommandRow = memo(
  ({ item, onSelect }: { item: SlashCommand; onSelect: (cmd: SlashCommand) => void }) => {
    const { colors } = useTheme();
    const catColor = item.category === "openclaw" ? colors.brand.blue : colors.accent.purple;

    return (
      <Pressable onPress={() => onSelect(item)}>
        {({ pressed }) => (
          <XStack
            paddingHorizontal={16}
            paddingVertical={10}
            gap={8}
            alignItems="center"
            backgroundColor={pressed ? colors.bg.elevated : "transparent"}
          >
            <View style={[rowStyles.dot, { backgroundColor: catColor }]} />
            <Text
              color={colors.text.primary}
              fontSize={14}
              fontWeight="600"
              fontFamily="$mono"
              flexShrink={0}
            >
              {item.command}
            </Text>
            <Text
              color={colors.text.muted}
              fontSize={12}
              numberOfLines={1}
              flex={1}
            >
              {item.description}
            </Text>
            {item.immediate && (
              <View style={[rowStyles.badge, { backgroundColor: catColor + "18" }]}>
                <ReturnIcon color={catColor} />
              </View>
            )}
          </XStack>
        )}
      </Pressable>
    );
  }
);

const rowStyles = StyleSheet.create({
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
});

export const SlashCommandPanel = memo(({ filter, onSelect }: Props) => {
  const { colors, isDark } = useTheme();

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
      borderTopLeftRadius={12}
      borderTopRightRadius={12}
      borderWidth={1}
      borderBottomWidth={0}
      borderColor={colors.border.subtle}
      maxHeight={280}
      {...(isDark && {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      })}
    >
      <FlatList
        data={grouped}
        keyExtractor={(g) => g.category}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: 4 }}
        renderItem={({ item: group }) => (
          <YStack>
            <XStack paddingHorizontal={16} paddingTop={8} paddingBottom={4}>
              <Text
                color={group.category === "openclaw" ? colors.brand.blue : colors.accent.purple}
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
