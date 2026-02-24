import React from 'react';
import { YStack, XStack, Text, Button, Spacer } from 'tamagui';
import { StatusPill } from './StatusPill';
import { Play, CheckCircle, AlertOctagon, MoreHorizontal } from 'lucide-react-native';

export function TaskCard({ task, onAction, onPress }) {
  return (
    <YStack 
      bg="$card" 
      br="$4" 
      p="$4" 
      mb="$3"
      borderWidth={1}
      borderColor="$border"
      pressStyle={{ bg: '$cardHover' }}
      onPress={onPress}
      animation="quick"
    >
      <XStack jc="space-between" ai="flex-start" mb="$2">
        <YStack f={1} mr="$3">
          <Text color="$text" fontSize="$5" fontWeight="700" numberOfLines={2} mb="$1">
            {task.title}
          </Text>
          <Text color="$textMuted" fontSize="$2" numberOfLines={1}>
            {task.skill || 'No skill'} · {task.priority?.toUpperCase()}
          </Text>
        </YStack>
        <StatusPill value={task.status} />
      </XStack>

      {(task.result || task.error) && (
        <YStack 
          bg={task.error ? '$dangerBg' : '$successBg'} 
          p="$2" 
          br="$2" 
          mb="$3"
        >
          <Text 
            color={task.error ? '$dangerText' : '$successText'} 
            fontSize="$2" 
            numberOfLines={2}
          >
            {task.error || task.result}
          </Text>
        </YStack>
      )}

      <XStack jc="flex-end" gap="$2" mt="$1">
        {/* Action Buttons based on status */}
        {task.status === 'queued' && (
          <Button 
            size="$2" 
            bg="$primary" 
            icon={Play} 
            color="white"
            onPress={() => onAction(task, 'pickup')}
          >
            Start
          </Button>
        )}
        
        {task.status === 'in-progress' && (
          <>
            <Button 
              size="$2" 
              bg="$success" 
              icon={CheckCircle} 
              onPress={() => onAction(task, 'complete')}
            />
            <Button 
              size="$2" 
              bg="$danger" 
              icon={AlertOctagon} 
              onPress={() => onAction(task, 'fail')}
            />
          </>
        )}
      </XStack>
    </YStack>
  );
}
