import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Text, XStack } from "tamagui";
import { useVideoPlayer, VideoView } from "expo-video";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Play, Pause, Volume2, ImageOff, VideoOff, VolumeX } from "@tamagui/lucide-icons";
import Markdown from "@ronradtke/react-native-markdown-display";
import { useTheme } from "../theme/theme-context";
import type { ColorPalette } from "../theme/colors";

type Props = {
  children: string;
  color?: string;
};

const VIDEO_EXTS = /\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/i;
const AUDIO_EXTS = /\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|$)/i;
const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp|svg|heic)(\?|$)/i;

const MEDIA_URL_RE =
  /(https?:\/\/[^\s)<>]+\.(?:mp4|mov|webm|m4v|avi|mkv|mp3|wav|ogg|m4a|aac|flac|opus|jpe?g|png|gif|webp|bmp|svg|heic)(?:\?[^\s)<>]*)?)/gi;

const isVideo = (uri: string) => VIDEO_EXTS.test(uri);
const isAudio = (uri: string) => AUDIO_EXTS.test(uri);
const isImage = (uri: string) => IMAGE_EXTS.test(uri);

const preProcessMedia = (text: string): string =>
  text.replace(MEDIA_URL_RE, (match, _g1, offset) => {
    const before = offset > 0 ? text[offset - 1] : "";
    const after = text[offset + match.length] ?? "";
    if (before === "(" || before === "[" || before === '"' || before === "!") return match;
    if (after === ")" || after === "]") return match;
    return `![](${match})`;
  });

const onLinkPress = (url: string) => {
  Linking.openURL(url);
  return false;
};

const mdStyles = (textColor: string, c: ColorPalette, isDark: boolean) =>
  StyleSheet.create({
    body: {
      color: textColor,
      fontSize: 15,
      lineHeight: 22,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 6,
    },
    heading1: {
      color: textColor,
      fontSize: 20,
      fontWeight: "700",
      marginTop: 12,
      marginBottom: 6,
    },
    heading2: {
      color: textColor,
      fontSize: 18,
      fontWeight: "700",
      marginTop: 10,
      marginBottom: 4,
    },
    heading3: {
      color: textColor,
      fontSize: 16,
      fontWeight: "600",
      marginTop: 8,
      marginBottom: 4,
    },
    strong: {
      fontWeight: "700",
    },
    em: {
      fontStyle: "italic",
    },
    link: {
      color: c.brand.blue,
      textDecorationLine: "underline" as const,
    },
    code_inline: {
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      color: c.accent.cyan,
      fontFamily: "Menlo",
      fontSize: 13,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 6,
    },
    fence: {
      backgroundColor: c.bg.codeBlock,
      borderColor: c.border.subtle,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginVertical: 6,
    },
    code_block: {
      backgroundColor: c.bg.codeBlock,
      borderColor: c.border.subtle,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginVertical: 6,
      fontFamily: "Menlo",
      fontSize: 12,
      color: c.text.secondary,
    },
    blockquote: {
      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
      borderLeftWidth: 3,
      borderLeftColor: c.brand.blue,
      paddingLeft: 12,
      paddingVertical: 4,
      marginVertical: 6,
      borderRadius: 4,
    },
    bullet_list: {
      marginVertical: 4,
    },
    ordered_list: {
      marginVertical: 4,
    },
    list_item: {
      marginVertical: 2,
    },
    bullet_list_icon: {
      color: c.text.muted,
      fontSize: 14,
      marginRight: 6,
    },
    ordered_list_icon: {
      color: c.text.muted,
      fontSize: 14,
      marginRight: 6,
    },
    table: {
      borderColor: c.border.subtle,
      borderWidth: 1,
      borderRadius: 6,
      marginVertical: 6,
    },
    thead: {
      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
    },
    th: {
      padding: 8,
      borderColor: c.border.subtle,
      color: c.text.primary,
      fontWeight: "600",
      fontSize: 13,
    },
    td: {
      padding: 8,
      borderColor: c.border.subtle,
      color: c.text.secondary,
      fontSize: 13,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: c.border.subtle,
    },
    hr: {
      backgroundColor: c.border.subtle,
      height: 1,
      marginVertical: 10,
    },
    image: {
      borderRadius: 8,
      marginVertical: 4,
    },
    textgroup: {},
    s: {
      textDecorationLine: "line-through" as const,
    },
  });

/* ── MediaErrorHint ────────────────────────────────────────── */

const BUBBLE_WIDTH_RATIO = 0.82;
const BUBBLE_H_PADDING = 28;

function MediaErrorHint({
  icon,
  label,
  uri,
}: {
  icon: React.ReactNode;
  label: string;
  uri: string;
}) {
  const { colors, isDark } = useTheme();
  const filename = uri.split("/").pop()?.split("?")[0] || uri;

  return (
    <Pressable
      onPress={() => Linking.openURL(uri).catch(() => {})}
      style={[mediaStyles.errorContainer, {
        backgroundColor: isDark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.06)",
        borderColor: isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.15)",
      }]}
    >
      <XStack alignItems="center" gap={8}>
        {icon}
        <View style={{ flex: 1 }}>
          <Text fontSize={13} color={colors.text.secondary} numberOfLines={1}>
            {label}
          </Text>
          <Text fontSize={11} color={colors.text.muted} numberOfLines={1}>
            {filename}
          </Text>
        </View>
      </XStack>
    </Pressable>
  );
}

/* ── AutoImage ─────────────────────────────────────────────── */

function AutoImage({ uri, alt, style }: { uri: string; alt?: string; style?: any }) {
  const { width: screenWidth } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const maxWidth = screenWidth * BUBBLE_WIDTH_RATIO - BUBBLE_H_PADDING;
  const [size, setSize] = useState({ width: maxWidth, height: maxWidth * 0.6 });
  const [error, setError] = useState(false);

  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => {
        const ratio = Math.min(maxWidth / w, 1);
        setSize({ width: w * ratio, height: h * ratio });
      },
      () => setError(true),
    );
  }, [uri, maxWidth]);

  if (error) {
    return (
      <MediaErrorHint
        icon={<ImageOff size={18} color={colors.text.muted} />}
        label="图片加载失败"
        uri={uri}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[style, { width: size.width, height: size.height }]}
      resizeMode="contain"
      accessible={!!alt}
      accessibilityLabel={alt || undefined}
      onError={() => setError(true)}
    />
  );
}

/* ── InlineVideo ───────────────────────────────────────────── */

function InlineVideo({ uri }: { uri: string }) {
  const { width: screenWidth } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const maxWidth = screenWidth * BUBBLE_WIDTH_RATIO - BUBBLE_H_PADDING;
  const height = maxWidth * 0.5625; // 16:9
  const [error, setError] = useState(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    const sub = player.addListener("statusChange", (evt: any) => {
      if (evt.status === "error" || evt.error) setError(true);
    });
    return () => sub.remove();
  }, [player]);

  if (error) {
    return (
      <MediaErrorHint
        icon={<VideoOff size={18} color={colors.text.muted} />}
        label="视频加载失败"
        uri={uri}
      />
    );
  }

  return (
    <View style={[mediaStyles.videoContainer, {
      width: maxWidth,
      height,
      backgroundColor: isDark ? "#1C1F26" : "#F3F4F6",
      borderColor: colors.border.subtle,
    }]}>
      <VideoView
        style={{ width: maxWidth, height }}
        player={player}
        nativeControls
        contentFit="contain"
      />
    </View>
  );
}

/* ── InlineAudio ───────────────────────────────────────────── */

function InlineAudio({ uri, alt }: { uri: string; alt?: string }) {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const maxWidth = screenWidth * BUBBLE_WIDTH_RATIO - BUBBLE_H_PADDING;
  const [error, setError] = useState(false);

  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;

  useEffect(() => {
    const sub = player.addListener("playbackStatusUpdate", (s: any) => {
      if (s.error || s.playbackState === "error") setError(true);
    });
    return () => sub.remove();
  }, [player]);

  const toggle = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = status.currentTime;
  const duration = status.duration;
  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const label = alt || uri.split("/").pop()?.split("?")[0] || "Audio";

  if (error) {
    return (
      <MediaErrorHint
        icon={<VolumeX size={18} color={colors.text.muted} />}
        label="音频加载失败"
        uri={uri}
      />
    );
  }

  return (
    <View style={[mediaStyles.audioContainer, {
      width: maxWidth,
      backgroundColor: isDark ? "#1C1F26" : "#F3F4F6",
      borderColor: colors.border.subtle,
    }]}>
      <XStack alignItems="center" gap={10} paddingHorizontal={12} paddingVertical={10}>
        <Pressable onPress={toggle} hitSlop={8}>
          <View style={[mediaStyles.playBtn, { backgroundColor: colors.brand.blue }]}>
            {isPlaying
              ? <Pause size={14} color="#FFF" fill="#FFF" />
              : <Play size={14} color="#FFF" fill="#FFF" />
            }
          </View>
        </Pressable>

        <View style={{ flex: 1, gap: 4 }}>
          <XStack alignItems="center" gap={6}>
            <Volume2 size={12} color={colors.text.muted} />
            <Text fontSize={12} color={colors.text.secondary} numberOfLines={1} flex={1}>
              {label}
            </Text>
            <Text fontSize={11} color={colors.text.muted} fontFamily="Menlo">
              {formatTime(progress)}{duration > 0 ? ` / ${formatTime(duration)}` : ""}
            </Text>
          </XStack>

          <View style={[mediaStyles.progressTrack, {
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
          }]}>
            <View style={[mediaStyles.progressFill, {
              width: `${pct}%` as any,
              backgroundColor: colors.brand.blue,
            }]} />
          </View>
        </View>
      </XStack>
    </View>
  );
}

/* ── Markdown image rule (dispatches image / video / audio) ── */

const mediaRule = (
  node: any,
  _children: any,
  _parent: any,
  styles: any,
  allowedImageHandlers: string[],
  defaultImageHandler: string | null,
) => {
  const { src, alt } = node.attributes;

  const show = allowedImageHandlers.some((h: string) =>
    src.toLowerCase().startsWith(h.toLowerCase()),
  );

  if (!show && defaultImageHandler === null) return null;

  const uri = show ? src : `${defaultImageHandler}${src}`;

  if (isVideo(uri)) {
    return <InlineVideo key={node.key} uri={uri} />;
  }
  if (isAudio(uri)) {
    return <InlineAudio key={node.key} uri={uri} alt={alt} />;
  }
  return <AutoImage key={node.key} uri={uri} alt={alt} style={styles._VIEW_SAFE_image} />;
};

const linkRule = (
  node: any,
  children: any,
  _parent: any,
  styles: any,
  onLinkPressFn: any,
) => {
  const href: string = node.attributes?.href ?? "";

  if (isVideo(href)) {
    return <InlineVideo key={node.key} uri={href} />;
  }
  if (isAudio(href)) {
    return <InlineAudio key={node.key} uri={href} alt={node.content} />;
  }
  if (isImage(href)) {
    return <AutoImage key={node.key} uri={href} alt={node.content} style={styles._VIEW_SAFE_image} />;
  }

  return (
    <Pressable
      key={node.key}
      accessibilityRole="link"
      onPress={() => {
        if (typeof onLinkPressFn === "function") {
          onLinkPressFn(href);
        } else {
          Linking.openURL(href);
        }
      }}
    >
      <Text style={styles.link}>{children}</Text>
    </Pressable>
  );
};

const customRules = { image: mediaRule, link: linkRule };

/* ── MarkdownBody ──────────────────────────────────────────── */

export const MarkdownBody = memo(({ children, color }: Props) => {
  const { colors, isDark } = useTheme();
  const isUserBubble = color === "#FFFFFF";
  const styles = mdStyles(isUserBubble ? "#FFFFFF" : colors.text.primary, colors, isDark);
  const processed = preProcessMedia(children);
  return (
    <Markdown style={styles} rules={customRules} onLinkPress={onLinkPress}>
      {processed}
    </Markdown>
  );
});

/* ── Media styles ──────────────────────────────────────────── */

const mediaStyles = StyleSheet.create({
  videoContainer: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginVertical: 4,
  },
  audioContainer: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginVertical: 4,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 1.5,
  },
  errorContainer: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 4,
  },
});
