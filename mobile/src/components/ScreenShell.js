import React from 'react';
import { H3, Paragraph, Spinner, YStack } from 'tamagui';

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
        <YStack ai="center" mt="$6">
          <Spinner size="large" color="$blue10" />
          <Paragraph color="$gray10" mt="$2">Loading...</Paragraph>
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
