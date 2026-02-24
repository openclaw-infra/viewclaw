import React from 'react';
import { Paragraph, XStack } from 'tamagui';

export function ToastBanner({ text, type = 'info' }) {
  if (!text) return null;
  const color = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6';
  return (
    <XStack bg={color + '33'} px="$3" py="$2" br="$2" mb="$2">
      <Paragraph color={color} fontWeight="700">{text}</Paragraph>
    </XStack>
  );
}
