import React from 'react';
import { YStack, XStack, Text, Button } from 'tamagui';
import { StatusPill } from './StatusPill';
import { Play, CheckCircle, XCircle } from 'lucide-react-native';

export function RunCard({ run, onAction }) {
  return (
    <YStack 
      bg="$card" 
      br="$4" 
      p="$4" 
      mb="$3"
      borderWidth={1}
      borderColor="$border"
    >
      <XStack jc="space-between" ai="center" mb="$2">
        <YStack>
          <Text color="$text" fontSize="$3" fontWeight="700">
            {run.id.slice(0, 8)}
          </Text>
          <Text color="$textMuted" fontSize="$2">
            Task: {run.taskId.slice(0, 8)}
          </Text>
        </YStack>
        <StatusPill value={run.status} />
      </XStack>

      <YStack gap="$1" mb="$3">
        <XStack gap="$2">
          <Text color="$textMuted" fontSize="$2">Executor:</Text>
          <Text color="$text" fontSize="$2" fontWeight="600">{run.executor}</Text>
        </XStack>
        {!!run.externalSessionKey && (
          <XStack gap="$2">
            <Text color="$textMuted" fontSize="$2">Session:</Text>
            <Text color="$primary" fontSize="$2">{run.externalSessionKey}</Text>
          </XStack>
        )}
      </YStack>

      {run.status === 'running' && (
        <XStack gap="$2" jc="flex-end">
          <Button 
            size="$2" 
            bg="$successBg" 
            borderColor="$successBg" 
            color="$successText"
            icon={CheckCircle}
            onPress={() => onAction(run, 'done')}
          >
            Finalize Done
          </Button>
          <Button 
            size="$2" 
            bg="$dangerBg" 
            borderColor="$dangerBg" 
            color="$dangerText"
            icon={XCircle}
            onPress={() => onAction(run, 'failed')}
          >
            Finalize Fail
          </Button>
        </XStack>
      )}
    </YStack>
  );
}
