import { memo, useCallback, useState, useRef, useEffect } from "react";
import {
  FlatList,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/theme-context";
import type { GatewayConfig } from "../types/gateway";

type Props = {
  visible: boolean;
  gateways: GatewayConfig[];
  activeId: string;
  onClose: () => void;
  onSwitch: (id: string) => void;
  onAdd: (config: { label: string; url: string }) => void;
  onUpdate: (id: string, patch: { label?: string; url?: string }) => void;
  onRemove: (id: string) => void;
};

type EditingState = {
  mode: "add" | "edit";
  id?: string;
  label: string;
  url: string;
};

const DRAWER_WIDTH_RATIO = 0.85;
const SWIPE_THRESHOLD = 60;

const GatewayRow = memo(
  ({
    item,
    isActive,
    onSelect,
    onEdit,
    onDelete,
  }: {
    item: GatewayConfig;
    isActive: boolean;
    onSelect: (id: string) => void;
    onEdit: (item: GatewayConfig) => void;
    onDelete: (id: string) => void;
  }) => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const isDefault = item.id === "default-local";

    return (
      <Pressable onPress={() => onSelect(item.id)}>
        {({ pressed }) => (
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            gap="$3"
            alignItems="center"
            backgroundColor={
              isActive
                ? colors.bg.elevated
                : pressed
                  ? colors.bg.tertiary
                  : "transparent"
            }
            borderLeftWidth={isActive ? 3 : 0}
            borderLeftColor={isActive ? colors.accent.green : "transparent"}
          >
            <YStack flex={1} gap="$1">
              <XStack alignItems="center" gap="$2">
                <Text
                  color={isActive ? colors.accent.green : colors.text.primary}
                  fontSize={14}
                  fontWeight="600"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {item.label}
                </Text>
                {isActive && (
                  <YStack
                    backgroundColor={colors.accent.green}
                    paddingHorizontal="$1.5"
                    paddingVertical={1}
                    borderRadius={4}
                  >
                    <Text color="#FFFFFF" fontSize={9} fontWeight="700">
                      {t("common.active")}
                    </Text>
                  </YStack>
                )}
              </XStack>
              <Text
                color={colors.text.muted}
                fontSize={11}
                fontFamily="$mono"
                numberOfLines={1}
              >
                {item.url}
              </Text>
            </YStack>

            <XStack gap="$2">
              <Pressable onPress={() => onEdit(item)}>
                <YStack
                  paddingHorizontal="$2"
                  paddingVertical="$1.5"
                  borderRadius={6}
                  backgroundColor={colors.bg.tertiary}
                >
                  <Text color={colors.text.secondary} fontSize={11}>
                    {t("common.edit")}
                  </Text>
                </YStack>
              </Pressable>
              {!isDefault && (
                <Pressable onPress={() => onDelete(item.id)}>
                  <YStack
                    paddingHorizontal="$2"
                    paddingVertical="$1.5"
                    borderRadius={6}
                    backgroundColor={colors.bg.tertiary}
                  >
                    <Text color={colors.accent.red} fontSize={11}>
                      {t("gateway.del")}
                    </Text>
                  </YStack>
                </Pressable>
              )}
            </XStack>
          </XStack>
        )}
      </Pressable>
    );
  },
);

const WS_URL_PATTERN = /^wss?:\/\/.+/;

const GradientBorderInput = memo(
  ({
    value,
    onChangeText,
    placeholder,
    colors,
    focused,
    onFocus,
    onBlur,
    mono,
    keyboardType,
    autoCapitalize,
    autoCorrect,
    hasError,
    inputRef,
  }: {
    value: string;
    onChangeText: (t: string) => void;
    placeholder: string;
    colors: ReturnType<typeof useTheme>["colors"];
    focused: boolean;
    onFocus: () => void;
    onBlur: () => void;
    mono?: boolean;
    keyboardType?: "default" | "url";
    autoCapitalize?: "none" | "sentences";
    autoCorrect?: boolean;
    hasError?: boolean;
    inputRef?: React.RefObject<TextInput | null>;
  }) => {
    const borderAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(borderAnim, {
        toValue: focused ? 1 : 0,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
    }, [focused, borderAnim]);

    const borderColor = hasError
      ? colors.state.error
      : borderAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [colors.border.subtle, colors.brand.blue],
        });

    return (
      <Animated.View
        style={{
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: colors.bg.tertiary,
        }}
      >
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.muted}
          onFocus={onFocus}
          onBlur={onBlur}
          autoCapitalize={autoCapitalize ?? "sentences"}
          autoCorrect={autoCorrect ?? true}
          keyboardType={keyboardType ?? "default"}
          style={{
            color: colors.text.primary,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 14,
            fontFamily: mono ? "monospace" : undefined,
          }}
        />
      </Animated.View>
    );
  },
);

const EditFormModal = memo(
  ({
    editing,
    onSave,
    onCancel,
  }: {
    editing: EditingState;
    onSave: (label: string, url: string) => void;
    onCancel: () => void;
  }) => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const [label, setLabel] = useState(editing.label);
    const [url, setUrl] = useState(editing.url);
    const [focusedField, setFocusedField] = useState<"label" | "url" | null>(null);
    const [urlTouched, setUrlTouched] = useState(false);

    const screenHeight = Dimensions.get("window").height;
    const slideAnim = useRef(new Animated.Value(screenHeight)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const urlInputRef = useRef<TextInput | null>(null);

    const canSave = label.trim().length > 0 && url.trim().length > 0;
    const urlValid = WS_URL_PATTERN.test(url.trim());
    const showUrlError = urlTouched && url.trim().length > 0 && !urlValid;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, [slideAnim, backdropAnim]);

    const animatedDismiss = useCallback(
      (cb: () => void) => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: screenHeight,
            duration: 280,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(backdropAnim, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(cb);
      },
      [slideAnim, backdropAnim, screenHeight],
    );

    const handleCancel = useCallback(() => {
      animatedDismiss(onCancel);
    }, [animatedDismiss, onCancel]);

    const handleSave = useCallback(() => {
      if (!canSave || !urlValid) return;
      animatedDismiss(() => onSave(label.trim(), url.trim()));
    }, [canSave, urlValid, animatedDismiss, onSave, label, url]);

    const saveEnabled = canSave && urlValid;

    return (
      <Modal visible transparent animationType="none" onRequestClose={handleCancel}>
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(0,0,0,0.55)",
            opacity: backdropAnim,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={handleCancel} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
          pointerEvents="box-none"
        >
          <Animated.View
            style={{
              transform: [{ translateY: slideAnim }],
            }}
          >
            <YStack
              backgroundColor={colors.bg.secondary}
              borderTopLeftRadius={24}
              borderTopRightRadius={24}
              paddingBottom={Platform.OS === "ios" ? 36 : 24}
              overflow="hidden"
            >
              <YStack alignItems="center" paddingVertical={12}>
                <YStack
                  width={40}
                  height={4}
                  borderRadius={2}
                  backgroundColor={colors.border.medium}
                  opacity={0.5}
                />
              </YStack>

              <XStack
                alignItems="center"
                justifyContent="space-between"
                paddingHorizontal={20}
                paddingBottom={16}
              >
                <Text
                  color={colors.text.primary}
                  fontSize={20}
                  fontWeight="700"
                >
                  {editing.mode === "add"
                    ? t("gateway.addGateway")
                    : t("gateway.editGateway")}
                </Text>
                <Pressable onPress={handleCancel}>
                  <YStack
                    width={32}
                    height={32}
                    borderRadius={16}
                    backgroundColor={colors.bg.tertiary}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text color={colors.text.secondary} fontSize={16} fontWeight="600">
                      ✕
                    </Text>
                  </YStack>
                </Pressable>
              </XStack>

              <YStack paddingHorizontal={20} gap={20}>
                <YStack gap={8}>
                  <Text color={colors.text.secondary} fontSize={14} fontWeight="500">
                    {t("gateway.label")}
                  </Text>
                  <GradientBorderInput
                    value={label}
                    onChangeText={setLabel}
                    placeholder={t("gateway.labelPlaceholder")}
                    colors={colors}
                    focused={focusedField === "label"}
                    onFocus={() => setFocusedField("label")}
                    onBlur={() => setFocusedField(null)}
                  />
                </YStack>

                <YStack gap={8}>
                  <Text color={colors.text.secondary} fontSize={14} fontWeight="500">
                    {t("gateway.websocketUrl")}
                  </Text>
                  <GradientBorderInput
                    value={url}
                    onChangeText={(t) => {
                      setUrl(t);
                      if (!urlTouched) setUrlTouched(true);
                    }}
                    placeholder={t("gateway.urlPlaceholder")}
                    colors={colors}
                    focused={focusedField === "url"}
                    onFocus={() => setFocusedField("url")}
                    onBlur={() => {
                      setFocusedField(null);
                      setUrlTouched(true);
                    }}
                    mono
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    hasError={showUrlError}
                    inputRef={urlInputRef}
                  />
                  {showUrlError && (
                    <Text color={colors.state.error} fontSize={12}>
                      {t("gateway.urlFormatHint")}
                    </Text>
                  )}
                </YStack>

                <XStack gap={12} paddingTop={4}>
                  <Pressable onPress={handleCancel} style={{ flex: 1 }}>
                    <YStack
                      paddingVertical={14}
                      borderRadius={12}
                      backgroundColor={colors.bg.tertiary}
                      alignItems="center"
                    >
                      <Text
                        color={colors.text.secondary}
                        fontSize={14}
                        fontWeight="600"
                      >
                        {t("common.cancel")}
                      </Text>
                    </YStack>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={!saveEnabled}
                    style={{ flex: 1 }}
                  >
                    {saveEnabled ? (
                      <LinearGradient
                        colors={[colors.brand.blue, colors.brand.purple]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: "center" as const,
                        }}
                      >
                        <Text color="#FFFFFF" fontSize={14} fontWeight="600">
                          {t("common.save")}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <YStack
                        paddingVertical={14}
                        borderRadius={12}
                        backgroundColor={colors.bg.elevated}
                        alignItems="center"
                        opacity={0.5}
                      >
                        <Text
                          color={colors.text.muted}
                          fontSize={14}
                          fontWeight="600"
                        >
                          {t("common.save")}
                        </Text>
                      </YStack>
                    )}
                  </Pressable>
                </XStack>
              </YStack>
            </YStack>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    );
  },
);

export const GatewaySheet = memo(
  ({
    visible,
    gateways,
    activeId,
    onClose,
    onSwitch,
    onAdd,
    onUpdate,
    onRemove,
  }: Props) => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const [editing, setEditing] = useState<EditingState | null>(null);

    const screenWidth = Dimensions.get("window").width;
    const drawerWidth = screenWidth * DRAWER_WIDTH_RATIO;
    const slideAnim = useRef(new Animated.Value(drawerWidth)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (visible) {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(backdropAnim, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        slideAnim.setValue(drawerWidth);
        backdropAnim.setValue(0);
      }
    }, [visible, slideAnim, backdropAnim, drawerWidth]);

    const animatedClose = useCallback(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: drawerWidth,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => onClose());
    }, [slideAnim, backdropAnim, drawerWidth, onClose]);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) && g.dx > 0,
        onPanResponderMove: (_, g) => {
          if (g.dx > 0) slideAnim.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE_THRESHOLD || g.vx > 0.5) {
            Animated.parallel([
              Animated.timing(slideAnim, {
                toValue: drawerWidth,
                duration: 200,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(backdropAnim, {
                toValue: 0,
                duration: 200,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
              }),
            ]).start(() => onClose());
          } else {
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: true,
              tension: 120,
              friction: 14,
            }).start();
          }
        },
      }),
    ).current;

    const handleSelect = useCallback(
      (id: string) => {
        onSwitch(id);
        animatedClose();
      },
      [onSwitch, animatedClose],
    );

    const handleEdit = useCallback((item: GatewayConfig) => {
      setEditing({ mode: "edit", id: item.id, label: item.label, url: item.url });
    }, []);

    const handleDelete = useCallback(
      (id: string) => {
        Alert.alert(t("gateway.removeGateway"), t("gateway.removeConfirm"), [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.remove"),
            style: "destructive",
            onPress: () => onRemove(id),
          },
        ]);
      },
      [onRemove],
    );

    const handleSave = useCallback(
      (label: string, url: string) => {
        if (!editing) return;
        if (editing.mode === "add") {
          onAdd({ label, url });
        } else if (editing.id) {
          onUpdate(editing.id, { label, url });
        }
        setEditing(null);
      },
      [editing, onAdd, onUpdate],
    );

    const handleCancel = useCallback(() => setEditing(null), []);

    const openAddForm = useCallback(() => {
      setEditing({ mode: "add", label: "", url: "ws://" });
    }, []);

    return (
      <Modal
        visible={visible}
        animationType="none"
        transparent
        onRequestClose={animatedClose}
      >
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
          <Animated.View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: "rgba(0,0,0,0.5)",
              opacity: backdropAnim,
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={animatedClose} />
          </Animated.View>

          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: drawerWidth,
              transform: [{ translateX: slideAnim }],
            }}
          >
          <YStack
            flex={1}
            backgroundColor={colors.bg.secondary}
            borderTopLeftRadius={24}
            borderBottomLeftRadius={24}
            overflow="hidden"
            shadowColor="#000"
            shadowOffset={{ width: -4, height: 0 }}
            shadowOpacity={0.15}
            shadowRadius={16}
            elevation={8}
          >
            <YStack paddingTop={60} />

            <XStack
              alignItems="center"
              justifyContent="space-between"
              paddingHorizontal={16}
              paddingVertical={12}
            >
              <Text
                color={colors.text.primary}
                fontSize={20}
                fontWeight="700"
              >
                {t("gateway.title")}
              </Text>
              <Pressable onPress={openAddForm}>
                <YStack
                  paddingHorizontal={12}
                  paddingVertical={6}
                  borderRadius={12}
                  backgroundColor={colors.brand.blue}
                >
                  <Text color="#FFFFFF" fontSize={12} fontWeight="600">
                    {t("common.add")}
                  </Text>
                </YStack>
              </Pressable>
            </XStack>

            <XStack paddingHorizontal={16} paddingBottom={8}>
              <Text color={colors.text.muted} fontSize={12}>
                {t("gateway.gatewayCount", { count: gateways.length })}
              </Text>
            </XStack>

            <FlatList
              data={gateways}
              keyExtractor={(g) => g.id}
              renderItem={({ item }) => (
                <GatewayRow
                  item={item}
                  isActive={item.id === activeId}
                  onSelect={handleSelect}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )}
              contentContainerStyle={{ paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <YStack
                  alignItems="center"
                  justifyContent="center"
                  paddingVertical="$10"
                  gap="$2"
                >
                  <Text color={colors.text.muted} fontSize={14}>
                    {t("gateway.noGateways")}
                  </Text>
                </YStack>
              }
            />
          </YStack>
        </Animated.View>
        </View>

        {editing && (
          <EditFormModal
            editing={editing}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}
      </Modal>
    );
  },
);
