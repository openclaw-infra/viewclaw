import { memo } from "react";
import { Linking, StyleSheet } from "react-native";
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

const mdStyles = (textColor: string, c: ColorPalette) =>
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
      color: c.text.primary,
      fontSize: 22,
      fontWeight: "700",
      marginTop: 12,
      marginBottom: 6,
    },
    heading2: {
      color: c.text.primary,
      fontSize: 19,
      fontWeight: "700",
      marginTop: 10,
      marginBottom: 4,
    },
    heading3: {
      color: c.text.primary,
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
      color: c.accent.blue,
      textDecorationLine: "underline" as const,
    },
    code_inline: {
      backgroundColor: "rgba(255,255,255,0.08)",
      color: c.accent.cyan,
      fontFamily: "Menlo",
      fontSize: 13,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    fence: {
      backgroundColor: "rgba(0,0,0,0.4)",
      borderColor: c.border.subtle,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginVertical: 6,
    },
    code_block: {
      backgroundColor: "rgba(0,0,0,0.4)",
      borderColor: c.border.subtle,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginVertical: 6,
      fontFamily: "Menlo",
      fontSize: 13,
      color: c.text.secondary,
    },
    blockquote: {
      backgroundColor: "rgba(255,255,255,0.03)",
      borderLeftWidth: 3,
      borderLeftColor: c.accent.blue,
      paddingLeft: 12,
      paddingVertical: 4,
      marginVertical: 6,
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
      backgroundColor: "rgba(255,255,255,0.05)",
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

export const MarkdownBody = memo(({ children, color }: Props) => {
  const { colors } = useTheme();
  const isUserBubble = color === "#FFFFFF";
  const styles = mdStyles(isUserBubble ? "#FFFFFF" : colors.text.primary, colors);
  return (
    <Markdown style={styles} onLinkPress={onLinkPress}>
      {children}
    </Markdown>
  );
});
