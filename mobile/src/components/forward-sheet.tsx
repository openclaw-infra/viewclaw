import { memo, useCallback, useRef, useEffect } from "react";
import {
  FlatList,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { ArrowRight } from "@tamagui/lucide-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/theme-context";
import type { SessionInfo } from "../types/gateway";

type Props = {
  visible: boolean;
  sessions: SessionInfo[];
  currentSessionId: string;
  messagePreview: string;
  onClose: () => void;
  onSelect: (targetSessionId: string) => void;
};

const ForwardRow = memo(
  ({
    item,
    onSelect,
  }: {
    item: SessionInfo;
    onSelect: (id: string) => void;
  }) => {
    const { colors } = useTheme();
    const shortId = item.id.slice(0, 8);
    const displayTitle =
      item.title ??
      (item.sessionKey
        ? item.sessionKey
            .replace(/^agent:\w+:/, "")
            .replace(/^openresponses:/, "")
            .slice(0, 20)
        : shortId);

    return (
      <Pressable onPress={() => onSelect(item.id)}>
        {({ pressed }) => (
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            gap="$3"
            alignItems="center"
            backgroundColor={pressed ? colors.bg.tertiary : "transparent"}
          >
            <YStack flex={1} gap="$1">
              <Text
                color={colors.text.primary}
                fontSize={14}
                fontWeight="600"
                numberOfLines={1}
              >
                {displayTitle}
              </Text>
              <Text color={colors.text.muted} fontSize={11} fontFamily="$mono">
                {shortId}
              </Text>
            </YStack>
            <ArrowRight size={16} color={colors.text.muted} />
          </XStack>
        )}
      </Pressable>
    );
  },
);

export const ForwardSheet = memo(
  ({
    visible,
    sessions,
    currentSessionId,
    messagePreview,
    onClose,
    onSelect,
  }: Props) => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const screenHeight = Dimensions.get("window").height;
    const slideAnim = useRef(new Animated.Value(screenHeight)).current;

    const otherSessions = sessions.filter((s) => s.id !== currentSessionId);

    useEffect(() => {
      if (visible) {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      } else {
        slideAnim.setValue(screenHeight);
      }
    }, [visible, slideAnim, screenHeight]);

    const animatedClose = useCallback(() => {
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onClose());
    }, [slideAnim, screenHeight, onClose]);

    const handleSelect = useCallback(
      (id: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSelect(id);
        animatedClose();
      },
      [onSelect, animatedClose],
    );

    return (
      <Modal
        visible={visible}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={animatedClose}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
          onPress={animatedClose}
        >
          <Animated.View
            style={{
              flex: 1,
              marginTop: screenHeight * 0.35,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <Pressable
              style={{ flex: 1 }}
              onPress={(e) => e.stopPropagation?.()}
            >
              <YStack
                flex={1}
                backgroundColor={colors.bg.secondary}
                borderTopLeftRadius={24}
                borderTopRightRadius={24}
                overflow="hidden"
              >
                <YStack alignItems="center" paddingVertical={10}>
                  <YStack
                    width={40}
                    height={4}
                    borderRadius={2}
                    backgroundColor={colors.border.medium}
                    opacity={0.6}
                  />
                </YStack>

                <YStack paddingHorizontal={16} paddingBottom={12} gap={8}>
                  <Text
                    color={colors.text.primary}
                    fontSize={20}
                    fontWeight="700"
                  >
                    {t("forwardSheet.title")}
                  </Text>

                  <YStack
                    backgroundColor={colors.bg.tertiary}
                    borderRadius={12}
                    paddingHorizontal={12}
                    paddingVertical={10}
                    borderWidth={StyleSheet.hairlineWidth}
                    borderColor={colors.border.subtle}
                  >
                    <Text
                      color={colors.text.muted}
                      fontSize={11}
                      fontWeight="500"
                      marginBottom={4}
                    >
                      {t("forwardSheet.preview")}
                    </Text>
                    <Text
                      color={colors.text.secondary}
                      fontSize={13}
                      numberOfLines={3}
                    >
                      {messagePreview}
                    </Text>
                  </YStack>
                </YStack>

                <FlatList
                  data={otherSessions}
                  keyExtractor={(s) => s.id}
                  renderItem={({ item }) => (
                    <ForwardRow item={item} onSelect={handleSelect} />
                  )}
                  contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <YStack
                      alignItems="center"
                      justifyContent="center"
                      paddingVertical="$10"
                    >
                      <Text color={colors.text.muted} fontSize={14}>
                        {t("forwardSheet.noSessions")}
                      </Text>
                    </YStack>
                  }
                />
              </YStack>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  },
);
