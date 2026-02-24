import React from 'react';
import { YStack } from 'tamagui';

export function SkeletonList({ count = 3 }) {
  return (
    <YStack gap="$2">
      {Array.from({ length: count }).map((_, i) => (
        <YStack key={i} bg="#1f2a44" br="$3" h={72} opacity={0.6} />
      ))}
    </YStack>
  );
}
