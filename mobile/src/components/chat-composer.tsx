import { useState, useCallback, useMemo } from "react";
import { Pressable, Alert, View, StyleSheet } from "react-native";
import { Input, Text, XStack, YStack } from "tamagui";
import { colors } from "../theme/colors";
import { SlashCommandPanel } from "./slash-command-panel";
import { useVoiceRecorder } from "../hooks/use-voice-recorder";
import type { SlashCommand } from "../data/slash-commands";

type Props = {
  sending: boolean;
  gatewayHttpUrl: string;
  onSend: (text: string) => void;
};

const formatDuration = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

const MicIcon = ({ color }: { color: string }) => (
  <View style={micStyles.container}>
    {/* Mic head (rounded rect) */}
    <View style={[micStyles.head, { backgroundColor: color }]} />
    {/* Mic arc */}
    <View style={[micStyles.arc, { borderColor: color }]} />
    {/* Mic stem */}
    <View style={[micStyles.stem, { backgroundColor: color }]} />
  </View>
);

const micStyles = StyleSheet.create({
  container: { width: 16, height: 20, alignItems: "center" },
  head: { width: 8, height: 11, borderRadius: 4 },
  arc: {
    width: 12,
    height: 8,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: "transparent",
    marginTop: -2,
  },
  stem: { width: 1.5, height: 4, marginTop: -1 },
  stopIcon: { width: 10, height: 10, borderRadius: 2 },
});

export const ChatComposer = ({ sending, gatewayHttpUrl, onSend }: Props) => {
  const [value, setValue] = useState("");
  const canSend = value.trim().length > 0 && !sending;

  const voice = useVoiceRecorder({
    gatewayHttpUrl,
    onTranscript: (text) => {
      setValue((prev) => {
        const joined = prev ? prev.trimEnd() + " " + text : text;
        return joined;
      });
    },
    onError: (msg) => Alert.alert("Voice Error", msg),
  });

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
    [onSend],
  );

  const handleMicPress = useCallback(() => {
    if (voice.status === "idle") {
      voice.startRecording();
    } else if (voice.status === "recording") {
      voice.stopAndTranscribe();
    }
  }, [voice]);

  const handleMicLongPress = useCallback(() => {
    if (voice.status === "recording") {
      voice.cancelRecording();
    }
  }, [voice]);

  const isRecording = voice.status === "recording";
  const isTranscribing = voice.status === "transcribing";
  const isVoiceBusy = isRecording || isTranscribing;

  return (
    <YStack>
      {slashState?.active && (
        <SlashCommandPanel filter={slashState.filter} onSelect={handleSelect} />
      )}

      {isRecording && (
        <XStack
          backgroundColor={colors.bg.secondary}
          paddingHorizontal="$4"
          paddingVertical="$2"
          alignItems="center"
          justifyContent="center"
          gap="$2"
        >
          <YStack width={8} height={8} borderRadius={4} backgroundColor={colors.accent.red} />
          <Text color={colors.accent.red} fontSize={13} fontWeight="600" fontFamily="$mono">
            {formatDuration(voice.durationMs)}
          </Text>
          <Text color={colors.text.muted} fontSize={12}>
            Tap mic to finish · Long press to cancel
          </Text>
        </XStack>
      )}

      {isTranscribing && (
        <XStack
          backgroundColor={colors.bg.secondary}
          paddingHorizontal="$4"
          paddingVertical="$2"
          alignItems="center"
          justifyContent="center"
          gap="$2"
        >
          <Text color={colors.accent.cyan} fontSize={13} fontWeight="600">
            Transcribing...
          </Text>
        </XStack>
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
          borderColor={
            isRecording
              ? colors.accent.red
              : slashState?.active
                ? colors.accent.blue
                : colors.border.subtle
          }
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
            editable={!isVoiceBusy}
          />

          {/* Mic button */}
          <Pressable
            onPress={handleMicPress}
            onLongPress={handleMicLongPress}
            disabled={isTranscribing || sending}
          >
            <YStack
              width={36}
              height={36}
              borderRadius={18}
              backgroundColor={
                isRecording
                  ? colors.accent.red
                  : isTranscribing
                    ? colors.bg.elevated
                    : colors.bg.elevated
              }
              alignItems="center"
              justifyContent="center"
              opacity={isTranscribing ? 0.5 : 1}
            >
              {isRecording ? (
                <View style={[micStyles.stopIcon, { backgroundColor: "#FFFFFF" }]} />
              ) : (
                <MicIcon color={colors.text.muted} />
              )}
            </YStack>
          </Pressable>

          {/* Send button */}
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
                {sending ? "..." : "↑"}
              </Text>
            </YStack>
          </Pressable>
        </XStack>
      </YStack>
    </YStack>
  );
};
