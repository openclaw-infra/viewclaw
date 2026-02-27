import { memo, useEffect, useState } from "react";
import { Image, Linking, StyleSheet, useWindowDimensions } from "react-native";
import Markdown from "@ronradtke/react-native-markdown-display";
import { useTheme } from "../theme/theme-context";
import type { ColorPalette } from "../theme/colors";

type Props = {
  children: string;
  color?: string;
};

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

function AutoImage({ uri, alt, style }: { uri: string; alt?: string; style?: any }) {
  const { width: screenWidth } = useWindowDimensions();
  const maxWidth = screenWidth - 80;
  const [size, setSize] = useState({ width: maxWidth, height: maxWidth * 0.6 });

  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => {
        const ratio = Math.min(maxWidth / w, 1);
        setSize({ width: w * ratio, height: h * ratio });
      },
      () => {},
    );
  }, [uri, maxWidth]);

  return (
    <Image
      source={{ uri }}
      style={[style, { width: size.width, height: size.height }]}
      resizeMode="contain"
      accessible={!!alt}
      accessibilityLabel={alt || undefined}
    />
  );
}

const imageRule = (
  node: any,
  _children: any,
  _parent: any,
  styles: any,
  allowedImageHandlers: string[],
  defaultImageHandler: string | null,
) => {
  const { src, alt } = node.attributes;
  const show = allowedImageHandlers.some(
    (h: string) => src.toLowerCase().startsWith(h.toLowerCase()),
  );

  if (!show && defaultImageHandler === null) return null;

  const uri = show ? src : `${defaultImageHandler}${src}`;

  return <AutoImage key={node.key} uri={uri} alt={alt} style={styles._VIEW_SAFE_image} />;
};

const customRules = { image: imageRule };

export const MarkdownBody = memo(({ children, color }: Props) => {
  const { colors, isDark } = useTheme();
  const isUserBubble = color === "#FFFFFF";
  const styles = mdStyles(isUserBubble ? "#FFFFFF" : colors.text.primary, colors, isDark);
  return (
    <Markdown style={styles} rules={customRules} onLinkPress={onLinkPress}>
      {children}
    </Markdown>
  );
});
