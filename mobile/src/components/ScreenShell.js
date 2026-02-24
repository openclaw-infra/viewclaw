import React from 'react';
import { H3, Paragraph, YStack } from 'tamagui';
import { SkeletonList } from './SkeletonList';

export function ScreenShell({ title, subtitle, loading, error, children, right }) {
  return (
    <YStack f={1} p="$3" gap="$3">
      <YStack>
        <YStack fd="row" jc="space-between" ai="center">
          <H3 color="white">{title}</H3>
          {right}
        </YStack>
        {!!subtitle && <Paragraph color="$gray10">{subtitle}</Paragraph>}
      </YStack>

      {loading ? (
        <YStack mt="$2">
          <SkeletonList count={4} />
        </YStack>
      ) : (
        <>
          {!!error && (
            <YStack bg="#3f1d2b" p="$2" br="$2">
              <Paragraph color="#fecdd3">{error}</Paragraph>
            </YStack>
          )}
          {children}
        </>
      )}
    </YStack>
  );
}
