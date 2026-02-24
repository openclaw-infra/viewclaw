import React from 'react';
import { YStack, Text, Button } from 'tamagui';
import { Inbox } from 'lucide-react-native';

export function EmptyState({ title = 'No Data', subtitle = 'Nothing to see here yet', actionText, onAction }) {
  return (
    <YStack ai="center" jc="center" py="$10" gap="$3" opacity={0.8}>
      <YStack bg="$card" p="$4" br="$pill" mb="$2">
        <Inbox size={32} color="$textMuted" />
      </YStack>
      <YStack ai="center" gap="$1">
        <Text color="$text" fontSize="$5" fontWeight="700">{title}</Text>
        <Text color="$textMuted" textAlign="center" maxWidth={250}>
          {subtitle}
        </Text>
      </YStack>
      {actionText && onAction && (
        <Button 
          mt="$4" 
          size="$3" 
          bg="$primary" 
          color="white" 
          onPress={onAction}
        >
          {actionText}
        </Button>
      )}
    </YStack>
  );
}
