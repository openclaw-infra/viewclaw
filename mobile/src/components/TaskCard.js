import React from 'react';
import { YStack, XStack, Text, Button } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';

export function TaskCard({ task, onAction, onPress }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'done': return '$success';
      case 'failed': return '$danger';
      case 'in-progress': return '$primary';
      default: return '$textMuted';
    }
  };

  return (
    <YStack 
      bg="$card" 
      br="$3" // Approx 12px based on new tokens
      p="$4" 
      mb="$3"
      bw={1}
      bc="$border"
      pressStyle={{ bg: '$cardHover', scale: 0.98 }}
      onPress={onPress}
      animation="quick"
      elevation={2}
    >
      <XStack jc="space-between" ai="flex-start" mb="$2">
        <YStack f={1} mr="$3">
          <Text color="$text" fontSize="$4" fw="600" numberOfLines={1} mb="$1">
            {task.title}
          </Text>
          <XStack ai="center" gap="$2">
            <Ionicons name="code-working-outline" size={12} color="$textMuted" />
            <Text color="$textMuted" fontSize="$2" numberOfLines={1}>
              {task.skill || 'No skill'}
            </Text>
            <Text color="$textSubtle" fontSize="$2">•</Text>
            <Text color="$textMuted" fontSize="$2">
              P{task.priority || '3'}
            </Text>
          </XStack>
        </YStack>
        
        <YStack 
          bg={getStatusColor(task.status)} 
          w={8} 
          h={8} 
          br="$pill" 
          mt="$2"
        />
      </XStack>

      {(task.result || task.error) && (
        <YStack 
          bg={task.error ? '$dangerBg' : '$primaryBg'} 
          p="$3" 
          br="$2" 
          mt="$2"
          bw={1}
          bc={task.error ? '$danger' : '$primary'}
          opacity={0.8}
        >
          <Text 
            color={task.error ? '$dangerText' : '$primaryText'} 
            fontSize="$1" 
            numberOfLines={2}
            fw="500"
          >
            {task.error || task.result}
          </Text>
        </YStack>
      )}

      {task.status !== 'done' && task.status !== 'failed' && (
        <XStack jc="flex-end" gap="$2" mt="$3">
          {task.status === 'queued' && (
            <Button 
              size="$2" 
              br="$pill"
              bg="$primary" 
              color="white"
              onPress={() => onAction(task, 'pickup')}
              icon={<Ionicons name="play" size={14} color="white" />}
            >
              Start
            </Button>
          )}
          
          {task.status === 'in-progress' && (
            <>
              <Button 
                size="$2" 
                br="$pill"
                variant="outlined"
                bc="$success"
                color="$success"
                onPress={() => onAction(task, 'complete')}
              >Done</Button>
              <Button 
                size="$2" 
                br="$pill"
                variant="outlined"
                bc="$danger"
                color="$danger"
                onPress={() => onAction(task, 'fail')}
              >Fail</Button>
            </>
          )}
        </XStack>
      )}
    </YStack>
  );
}
