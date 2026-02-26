import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Pressable, Alert, View, StyleSheet, Image, ScrollView, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Input, Text, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../theme/theme-context";
import { SlashCommandPanel } from "./slash-command-panel";
import { useVoiceRecorder } from "../hooks/use-voice-recorder";
import type { SlashCommand } from "../data/slash-commands";
import type { ImageAttachment } from "../types/gateway";

type Props = {
  sending: boolean;
  gatewayHttpUrl: string;
  onSend: (text: string, images?: ImageAttachment[]) => void;
};

const formatDuration = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

const ImageIcon = ({ color }: { color: string }) => (
  <View style={imgIconStyles.container}>
    <View style={[imgIconStyles.frame, { borderColor: color }]}>
      <View style={[imgIconStyles.sun, { backgroundColor: color }]} />
      <View style={[imgIconStyles.mountain, { borderBottomColor: color }]} />
    </View>
  </View>
);

const imgIconStyles = StyleSheet.create({
  container: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  frame: { width: 16, height: 14, borderWidth: 1.5, borderRadius: 2.5, position: "relative", overflow: "hidden" },
  sun: { width: 4, height: 4, borderRadius: 2, position: "absolute", top: 2, left: 2 },
  mountain: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 6,
    borderLeftColor: "transparent", borderRightColor: "transparent",
    position: "absolute", bottom: 0, right: 1,
  },
});

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

const SendArrow = ({ color }: { color: string }) => (
  <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
    <View style={{ width: 8, height: 8, borderTopWidth: 2, borderLeftWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }], marginTop: 3 }} />
    <View style={{ width: 2, height: 10, backgroundColor: color, borderRadius: 1, marginTop: -4 }} />
  </View>
);

export const ChatComposer = ({ sending, gatewayHttpUrl, onSend }: Props) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
    onSend(value, attachedImages.length > 0 ? attachedImages : undefined);
    setValue("");
    setAttachedImages([]);
  }, [canSend, value, attachedImages, onSend]);

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

  const slashVisible = !!slashState?.active;
  const slashAnim = useRef(new Animated.Value(0)).current;
  const [slashMounted, setSlashMounted] = useState(false);

  useEffect(() => {
    if (slashVisible) {
      setSlashMounted(true);
      Animated.timing(slashAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else if (slashMounted) {
      Animated.timing(slashAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setSlashMounted(false);
      });
    }
  }, [slashVisible]);

  return (
    <YStack>
      {slashMounted && (
        <Animated.View
          style={{
            opacity: slashAnim,
            transform: [{
              translateY: slashAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
          }}
        >
          <SlashCommandPanel filter={slashState?.filter ?? ""} onSelect={handleSelect} />
        </Animated.View>
      )}

      {isRecording && (
        <XStack
          backgroundColor={colors.bg.secondary}
          paddingHorizontal={16}
          paddingVertical={8}
          alignItems="center"
          justifyContent="center"
          gap={8}
        >
          <YStack width={8} height={8} borderRadius={4} backgroundColor={colors.accent.red} />
          <Text color={colors.accent.red} fontSize={13} fontWeight="600" fontFamily="$mono">
            {formatDuration(voice.durationMs)}
          </Text>
          <Text color={colors.text.muted} fontSize={12}>
            {t("chat.tapMicToFinish")}
          </Text>
        </XStack>
      )}

      {isTranscribing && (
        <XStack
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

        <XStack
          alignItems="center"
          gap={6}
          backgroundColor={colors.bg.tertiary}
          borderRadius={24}
          borderWidth={1}
          borderColor={
            isRecording
              ? colors.accent.red
              : slashState?.active
                ? colors.brand.blue
                : colors.border.subtle
          }
          paddingLeft={5}
          paddingRight={5}
          paddingVertical={4}
        >
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
              <ImageIcon color={colors.text.muted} />
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
                <View style={[micStyles.stopIcon, { backgroundColor: "#FFFFFF" }]} />
              ) : (
                <MicIcon color={colors.text.muted} />
              )}
            </YStack>
          </Pressable>

          <Pressable onPress={submit} disabled={!canSend}>
            {canSend ? (
              <LinearGradient
                colors={["#2CB5E8", "#8E2DE2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={sendBtnStyles.gradient}
              >
                {sending ? (
                  <Text color="#FFFFFF" fontSize={14} fontWeight="700">...</Text>
                ) : (
                  <SendArrow color="#FFFFFF" />
                )}
              </LinearGradient>
            ) : (
              <View style={[sendBtnStyles.inactive, { backgroundColor: colors.bg.elevated }]}>
                <SendArrow color={colors.text.muted} />
              </View>
            )}
          </Pressable>
        </XStack>
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
