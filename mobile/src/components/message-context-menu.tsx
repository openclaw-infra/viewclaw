import { memo, useCallback, useRef, useEffect } from "react";
import {
  Modal,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
} from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { Copy } from "@tamagui/lucide-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/theme-context";

export type MenuAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  pressPoint: { x: number; y: number } | null;
  content: string;
  extraActions?: MenuAction[];
  onClose: () => void;
};

const MENU_ANIM_DURATION = 180;

export const MessageContextMenu = memo(
  ({ visible, pressPoint, content, extraActions, onClose }: Props) => {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (visible) {
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: MENU_ANIM_DURATION,
            easing: Easing.out(Easing.back(1.4)),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: MENU_ANIM_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        scale.setValue(0);
        opacity.setValue(0);
      }
    }, [visible, scale, opacity]);

    const dismiss = useCallback(() => {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0,
          duration: 120,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 120,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => onClose());
    }, [scale, opacity, onClose]);

    const handleCopy = useCallback(async () => {
      await Clipboard.setStringAsync(content);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dismiss();
    }, [content, dismiss]);

    const actions: MenuAction[] = [
      {
        id: "copy",
        label: t("contextMenu.copy"),
        icon: <Copy size={16} color={colors.text.primary} />,
        onPress: handleCopy,
      },
      ...(extraActions ?? []),
    ];

    if (!visible || !pressPoint) return null;

    return (
      <Modal transparent visible animationType="none" onRequestClose={dismiss}>
        <Pressable style={styles.backdrop} onPress={dismiss}>
          <Animated.View
            style={[
              styles.menuContainer,
              {
                top: pressPoint.y,
                left: pressPoint.x,
                backgroundColor: isDark ? colors.bg.elevated : colors.bg.secondary,
                borderColor: colors.border.subtle,
                shadowColor: isDark ? "#000" : "#475569",
                opacity,
                transform: [
                  { translateX: -60 },
                  { translateY: -48 },
                  { scale },
                ],
              },
            ]}
          >
            <YStack>
              {actions.map((action, idx) => (
                <Pressable
                  key={action.id}
                  onPress={action.onPress}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                    },
                    idx < actions.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border.subtle,
                    },
                  ]}
                >
                  <XStack alignItems="center" gap={8}>
                    {action.icon}
                    <Text
                      fontSize={14}
                      fontWeight="500"
                      color={
                        action.destructive
                          ? colors.accent.red
                          : colors.text.primary
                      }
                    >
                      {action.label}
                    </Text>
                  </XStack>
                </Pressable>
              ))}
            </YStack>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  },
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  menuContainer: {
    position: "absolute",
    minWidth: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
