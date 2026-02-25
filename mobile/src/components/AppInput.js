import React from 'react';
import { Input, Text, YStack } from 'tamagui';
import { radius, usePalette } from '../theme';

export function AppInput({ label, style, inputStyle, ...props }) {
  const colors = usePalette();

  return (
    <YStack gap="$1" style={style}>
      {!!label && (
        <Text
          style={{
            color: colors.subtle,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.2,
          }}
        >
          {label}
        </Text>
      )}
      <Input
        placeholderTextColor={colors.muted}
        style={[
          {
            minHeight: 42,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            backgroundColor: colors.card,
            color: colors.text,
            paddingHorizontal: 12,
            fontSize: 13,
          },
          inputStyle,
        ]}
        {...props}
      />
    </YStack>
  );
}
