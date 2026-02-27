import { memo, useCallback, useState, useRef, useEffect } from "react";
import { FlatList, Pressable, Modal, TextInput, Alert, Animated, Dimensions, Easing } from "react-native";
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

const EditForm = memo(
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
    const canSave = label.trim().length > 0 && url.trim().length > 0;

    return (
      <YStack
        padding="$4"
        gap="$3"
        borderTopWidth={1}
        borderColor={colors.border.subtle}
      >
        <Text color={colors.text.primary} fontSize={15} fontWeight="600">
          {editing.mode === "add" ? t("gateway.addGateway") : t("gateway.editGateway")}
        </Text>

        <YStack gap="$1.5">
          <Text color={colors.text.secondary} fontSize={12}>
            {t("gateway.label")}
          </Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={t("gateway.labelPlaceholder")}
            placeholderTextColor={colors.text.muted}
            style={{
              backgroundColor: colors.bg.tertiary,
              color: colors.text.primary,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14,
              borderWidth: 1,
              borderColor: colors.border.subtle,
            }}
          />
        </YStack>

        <YStack gap="$1.5">
          <Text color={colors.text.secondary} fontSize={12}>
            {t("gateway.websocketUrl")}
          </Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder={t("gateway.urlPlaceholder")}
            placeholderTextColor={colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={{
              backgroundColor: colors.bg.tertiary,
              color: colors.text.primary,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 14,
              fontFamily: "monospace",
              borderWidth: 1,
              borderColor: colors.border.subtle,
            }}
          />
        </YStack>

        <XStack gap="$2" justifyContent="flex-end">
          <Pressable onPress={onCancel}>
            <YStack
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderRadius={8}
              backgroundColor={colors.bg.elevated}
            >
              <Text color={colors.text.secondary} fontSize={13} fontWeight="600">
                {t("common.cancel")}
              </Text>
            </YStack>
          </Pressable>
          <Pressable onPress={() => canSave && onSave(label.trim(), url.trim())} disabled={!canSave}>
            <YStack
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderRadius={8}
              backgroundColor={canSave ? colors.accent.blue : colors.bg.elevated}
              opacity={canSave ? 1 : 0.5}
            >
              <Text color={canSave ? "#FFFFFF" : colors.text.muted} fontSize={13} fontWeight="600">
                {t("common.save")}
              </Text>
            </YStack>
          </Pressable>
        </XStack>
      </YStack>
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
    const screenHeight = Dimensions.get("window").height;
    const slideAnim = useRef(new Animated.Value(screenHeight)).current;

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
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
          onPress={animatedClose}
        >
          <Animated.View
            style={{ flex: 1, marginTop: 120, transform: [{ translateY: slideAnim }] }}
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

              <XStack
                alignItems="center"
                justifyContent="space-between"
                paddingHorizontal={16}
                paddingVertical={10}
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

              {/* List */}
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

              {/* Edit / Add form */}
              {editing && (
                <EditForm
                  editing={editing}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              )}
            </YStack>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  },
);
