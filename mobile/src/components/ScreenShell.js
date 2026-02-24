import React from 'react';
import { YStack, XStack, Text, Spinner } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export function ScreenShell({ title, subtitle, loading, error, children, right }) {
  return (
    <YStack f={1} bg="$background">
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }}>
        <YStack px="$4" py="$3" gap="$1">
          <XStack ai="center" jc="space-between" mb="$2">
            <YStack>
              <Text color="$text" fontSize="$8" fontWeight="800">{title}</Text>
              {!!subtitle && <Text color="$textMuted" fontSize="$3">{subtitle}</Text>}
            </YStack>
            {right}
          </XStack>
        </YStack>

        <YStack f={1} px="$4">
          {loading ? (
            <YStack f={1} ai="center" jc="center" gap="$3">
              <Spinner size="large" color="$primary" />
              <Text color="$textMuted">Loading...</Text>
            </YStack>
          ) : error ? (
            <YStack bg="$dangerBg" p="$4" br="$3">
              <Text color="$dangerText" fontWeight="700" mb="$1">Request Error</Text>
              <Text color="$dangerText">{error}</Text>
            </YStack>
          ) : (
            children
          )}
        </YStack>
      </SafeAreaView>
    </YStack>
  );
}
