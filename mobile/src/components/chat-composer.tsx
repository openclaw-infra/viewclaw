import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Pressable, Alert, View, StyleSheet, Image, ScrollView } from "react-native";
import Reanimated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing as REasing } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Input, Text, XStack, YStack, AnimatePresence } from "tamagui";
import { useTranslation } from "react-i18next";
import { ImagePlus, Mic, Reply, Send, Square, X } from "@tamagui/lucide-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../theme/theme-context";
import { SlashCommandPanel } from "./slash-command-panel";
import { useVoiceRecorder } from "../hooks/use-voice-recorder";
import type { SlashCommand } from "../data/slash-commands";
import type { ImageAttachment } from "../types/gateway";

type Props = {
  sending: boolean;
  gatewayHttpUrl: string;
  replyContent?: string | null;
  onClearReply?: () => void;
  onSend: (text: string, images?: ImageAttachment[]) => void;
};

const formatDuration = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

const imgPreviewStyles = StyleSheet.create({
  wrapper: { width: 64, height: 64, borderRadius: 10, overflow: "hidden", position: "relative" },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  removeBtn: { position: "absolute", top: 2, right: 2 },
  removeBg: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center", justifyContent: "center",
  },
});

const RecordingPulse = ({ color }: { color: string }) => {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 900, easing: REasing.inOut(REasing.ease) }),
        withTiming(1, { duration: 900, easing: REasing.inOut(REasing.ease) }),
      ),
      -1,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 900, easing: REasing.inOut(REasing.ease) }),
        withTiming(1, { duration: 900, easing: REasing.inOut(REasing.ease) }),
      ),
      -1,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View
      style={[
        { width: 8, height: 8, borderRadius: 4, backgroundColor: color },
        animStyle,
      ]}
    />
  );
};

export const ChatComposer = ({ sending, gatewayHttpUrl, replyContent, onClearReply, onSend }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState("");
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
  const canSend = (value.trim().length > 0 || attachedImages.length > 0) && !sending;

  const voice = useVoiceRecorder({
    gatewayHttpUrl,
    onTranscript: (text) => {
      setValue((prev) => {
        const joined = prev ? prev.trimEnd() + " " + text : text;
        return joined;
      });
    },
    onError: (msg) => Alert.alert(t("voice.error"), msg),
  });

  const slashState = useMemo(() => {
    const trimmed = value.trimStart();
    if (!trimmed.startsWith("/")) return null;
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) return { active: true, filter: trimmed.slice(1) };
    return null;
  }, [value]);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.8,
    });
    if (result.canceled) return;
    const newImages: ImageAttachment[] = result.assets.map((a) => ({
      uri: a.uri,
      width: a.width,
      height: a.height,
    }));
    setAttachedImages((prev) => [...prev, ...newImages].slice(0, 4));
  }, []);

  const removeImage = useCallback((idx: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const submit = useCallback(() => {
    if (!canSend) return;
    let text = value;
    if (replyContent) {
      const preview = replyContent.length > 200 ? replyContent.slice(0, 200) + "…" : replyContent;
      text = `[Replying to: ${preview}]\n\n${value}`;
      onClearReply?.();
    }
    onSend(text, attachedImages.length > 0 ? attachedImages : undefined);
    setValue("");
    setAttachedImages([]);
  }, [canSend, value, attachedImages, replyContent, onSend, onClearReply]);

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

  const hasReply = !!replyContent;
  const slashVisible = !!slashState?.active;

  return (
    <YStack paddingBottom={insets.bottom}>
      <AnimatePresence>
        {slashVisible && (
          <YStack
            key="slash-panel"
            animation="quick"
            enterStyle={{ opacity: 0, y: 20 }}
            exitStyle={{ opacity: 0, y: 20 }}
          >
            <SlashCommandPanel filter={slashState?.filter ?? ""} onSelect={handleSelect} />
          </YStack>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRecording && (
          <XStack
            key="recording-bar"
            animation="quick"
            enterStyle={{ opacity: 0, y: -8 }}
            exitStyle={{ opacity: 0, y: -8 }}
            backgroundColor={colors.bg.secondary}
            paddingHorizontal={16}
            paddingVertical={8}
            alignItems="center"
            justifyContent="center"
            gap={8}
          >
            <RecordingPulse color={colors.accent.red} />
            <Text color={colors.accent.red} fontSize={13} fontWeight="600" fontFamily="$mono">
              {formatDuration(voice.durationMs)}
            </Text>
            <Text color={colors.text.muted} fontSize={12}>
              {t("chat.tapMicToFinish")}
            </Text>
          </XStack>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTranscribing && (
          <XStack
            key="transcribing-bar"
            animation="quick"
            enterStyle={{ opacity: 0, y: -8 }}
            exitStyle={{ opacity: 0, y: -8 }}
            backgroundColor={colors.bg.secondary}
            paddingHorizontal={16}
            paddingVertical={8}
            alignItems="center"
            justifyContent="center"
            gap={8}
          >
            <Text color={colors.brand.blue} fontSize={13} fontWeight="600">
              {t("chat.transcribing")}
            </Text>
          </XStack>
        )}
      </AnimatePresence>

      <YStack
        backgroundColor={colors.bg.secondary}
        borderTopWidth={1}
        borderColor={colors.border.subtle}
        paddingHorizontal={12}
        paddingVertical={10}
        gap={8}
      >
        {attachedImages.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
          >
            {attachedImages.map((img, idx) => (
              <View key={img.uri} style={imgPreviewStyles.wrapper}>
                <Image
                  source={{ uri: img.uri }}
                  style={imgPreviewStyles.thumb}
                />
                <Pressable
                  style={imgPreviewStyles.removeBtn}
                  onPress={() => removeImage(idx)}
                  hitSlop={8}
                >
                  <View style={imgPreviewStyles.removeBg}>
                    <Text color="#FFFFFF" fontSize={11} fontWeight="700" lineHeight={14}>
                      ✕
                    </Text>
                  </View>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        <YStack
          animation="lazy"
          backgroundColor={colors.bg.tertiary}
          borderRadius={14}
          borderWidth={1}
          borderColor={
            hasReply
              ? colors.brand.blue + "60"
              : isRecording
                ? colors.accent.red
                : slashState?.active
                  ? colors.brand.blue
                  : colors.border.subtle
          }
          overflow="hidden"
        >
          <AnimatePresence>
            {hasReply && (
              <YStack
                key="reply-preview"
                animation="quick"
                enterStyle={{ opacity: 0, y: -4 }}
                exitStyle={{ opacity: 0, y: -4 }}
              >
                <XStack
                  paddingHorizontal={12}
                  paddingTop={8}
                  paddingBottom={6}
                  alignItems="center"
                  gap={6}
                  borderBottomWidth={StyleSheet.hairlineWidth}
                  borderBottomColor={colors.border.subtle}
                >
                  <Reply size={12} color={colors.brand.blue} style={{ flexShrink: 0 }} />
                  <Text
                    color={colors.text.muted}
                    fontSize={12}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    flex={1}
                  >
                    {replyContent}
                  </Text>
                  <Pressable onPress={onClearReply} hitSlop={8}>
                    <X size={12} color={colors.text.muted} />
                  </Pressable>
                </XStack>
              </YStack>
            )}
          </AnimatePresence>

          <XStack alignItems="center" gap={6} paddingLeft={5} paddingRight={5} paddingVertical={4}>
            <Pressable onPress={pickImage} disabled={isVoiceBusy || sending || attachedImages.length >= 4}>
              <YStack
                width={34}
                height={34}
                borderRadius={17}
                backgroundColor={colors.bg.elevated}
                alignItems="center"
                justifyContent="center"
                opacity={attachedImages.length >= 4 ? 0.4 : 1}
              >
                <ImagePlus size={18} color={colors.text.muted} />
              </YStack>
            </Pressable>

            <Input
              flex={1}
              value={value}
              onChangeText={setValue}
              onSubmitEditing={submit}
              placeholder={t("chat.placeholder")}
              placeholderTextColor={colors.text.muted as any}
              backgroundColor="transparent"
              borderWidth={0}
              color={colors.text.primary}
              fontSize={15}
              paddingHorizontal={2}
              paddingVertical={8}
              returnKeyType="send"
              autoCorrect={false}
              editable={!isVoiceBusy}
            />

            <Pressable
              onPress={handleMicPress}
              onLongPress={handleMicLongPress}
              disabled={isTranscribing || sending}
            >
              <YStack
                width={34}
                height={34}
                borderRadius={17}
                backgroundColor={
                  isRecording
                    ? colors.accent.red
                    : colors.bg.elevated
                }
                alignItems="center"
                justifyContent="center"
                opacity={isTranscribing ? 0.5 : 1}
              >
                {isRecording ? (
                  <Square size={10} color="#FFFFFF" fill="#FFFFFF" />
                ) : (
                  <Mic size={18} color={colors.text.muted} />
                )}
              </YStack>
            </Pressable>

            <Pressable onPress={submit} disabled={!canSend}>
              {canSend ? (
                <YStack>
                  <LinearGradient
                    colors={["#2CB5E8", "#8E2DE2"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={sendBtnStyles.gradient}
                  >
                    {sending ? (
                      <Text color="#FFFFFF" fontSize={14} fontWeight="700">...</Text>
                    ) : (
                      <Send size={16} color="#FFFFFF" />
                    )}
                  </LinearGradient>
                </YStack>
              ) : (
                <View style={[sendBtnStyles.inactive, { backgroundColor: colors.bg.elevated }]}>
                  <Send size={16} color={colors.text.muted} />
                </View>
              )}
            </Pressable>
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  );
};

const sendBtnStyles = StyleSheet.create({
  gradient: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  inactive: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
