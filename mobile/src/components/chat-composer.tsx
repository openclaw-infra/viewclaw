import { useState, useCallback, useMemo } from "react";
import { Pressable } from "react-native";
import { Input, Text, XStack, YStack } from "tamagui";
import { colors } from "../theme/colors";
import { SlashCommandPanel } from "./slash-command-panel";
import type { SlashCommand } from "../data/slash-commands";

type Props = {
  sending: boolean;
  onSend: (text: string) => void;
};

export const ChatComposer = ({ sending, onSend }: Props) => {
  const [value, setValue] = useState("");
  const canSend = value.trim().length > 0 && !sending;

  const slashState = useMemo(() => {
    const trimmed = value.trimStart();
    if (!trimmed.startsWith("/")) return null;
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) return { active: true, filter: trimmed.slice(1) };
    return null;
  }, [value]);

  const submit = useCallback(() => {
    if (!canSend) return;
    onSend(value);
    setValue("");
  }, [canSend, value, onSend]);

  const handleSelect = useCallback(
    (cmd: SlashCommand) => {
      if (cmd.immediate) {
        onSend(cmd.command);
        setValue("");
      } else {
        setValue(cmd.fillText ?? cmd.command + " ");
      }
    },
    [onSend]
  );

  return (
    <YStack>
      {slashState?.active && (
        <SlashCommandPanel filter={slashState.filter} onSelect={handleSelect} />
      )}

      <YStack
        backgroundColor={colors.bg.secondary}
        borderTopWidth={1}
        borderColor={colors.border.subtle}
        paddingHorizontal="$3"
        paddingVertical="$2.5"
      >
        <XStack
          alignItems="center"
          gap="$2"
          backgroundColor={colors.bg.tertiary}
          borderRadius={24}
          borderWidth={1}
          borderColor={slashState?.active ? colors.accent.blue : colors.border.subtle}
          paddingLeft="$3.5"
          paddingRight="$1.5"
          paddingVertical="$1"
        >
          <Input
            flex={1}
            value={value}
            onChangeText={setValue}
            onSubmitEditing={submit}
            placeholder='Message OpenClaw... (type "/" for commands)'
            placeholderTextColor={colors.text.muted as any}
            backgroundColor="transparent"
            borderWidth={0}
            color={colors.text.primary}
            fontSize={15}
            paddingVertical="$2"
            returnKeyType="send"
            autoCorrect={false}
          />
          <Pressable onPress={submit} disabled={!canSend}>
            <YStack
              width={36}
              height={36}
              borderRadius={18}
              backgroundColor={canSend ? colors.accent.blue : colors.bg.elevated}
              alignItems="center"
              justifyContent="center"
            >
              <Text
                color={canSend ? "#FFFFFF" : colors.text.muted}
                fontSize={16}
                fontWeight="700"
              >
                {sending ? "..." : "\u2191"}
              </Text>
            </YStack>
          </Pressable>
        </XStack>
      </YStack>
    </YStack>
  );
};
