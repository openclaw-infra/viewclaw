import React from 'react';
import { Button, Text } from 'tamagui';
import { radius, usePalette } from '../theme';

const variants = {
  primary: (c) => ({ bg: c.primary, text: c.primaryText, border: c.tabActiveBorder }),
  info: (c) => ({ bg: c.info, text: c.infoText, border: '#2b63dc' }),
  success: (c) => ({ bg: c.success, text: c.successText, border: '#168f83' }),
  danger: (c) => ({ bg: c.danger, text: c.dangerText, border: '#d12d2d' }),
  ghost: (c) => ({ bg: c.card, text: c.info, border: c.cardBorder }),
};

export function AppButton({ title, onPress, variant = 'primary', small = false, style, textStyle, disabled = false }) {
  const colors = usePalette();
  const v = (variants[variant] || variants.primary)(colors);

  return (
    <Button
      onPress={onPress}
      disabled={disabled}
      pressStyle={{ opacity: 0.88, scale: 0.985 }}
      style={[
        {
          minHeight: small ? 30 : 40,
          paddingHorizontal: small ? 9 : 14,
          paddingVertical: small ? 5 : 9,
          borderRadius: radius.sm,
          borderWidth: 1,
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          {
            color: v.text,
            fontSize: small ? 11 : 13,
            fontWeight: '700',
            letterSpacing: 0.2,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Button>
  );
}
