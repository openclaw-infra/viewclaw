import React from 'react';
import { Paragraph, XStack } from 'tamagui';

const colorMap = {
  queued: '#f59e0b',
  'in-progress': '#3b82f6',
  done: '#22c55e',
  failed: '#ef4444',
  running: '#3b82f6',
};

export function StatusPill({ value }) {
  const c = colorMap[value] || '#6b7280';
  return (
    <XStack bg={c + '33'} px="$2" py="$1" br="$2">
      <Paragraph color={c} fontSize={12} fontWeight="700">{value}</Paragraph>
    </XStack>
  );
}
