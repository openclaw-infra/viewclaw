import React from 'react';
import { XStack, Text } from 'tamagui';

const styles = {
  queued: { bg: '$warningBg', text: '$warningText', label: 'QUEUED' },
  'in-progress': { bg: '$primaryBg', text: '$primaryText', label: 'RUNNING' },
  running: { bg: '$primaryBg', text: '$primaryText', label: 'RUNNING' },
  done: { bg: '$successBg', text: '$successText', label: 'DONE' },
  failed: { bg: '$dangerBg', text: '$dangerText', label: 'FAILED' },
};

export function StatusPill({ value, size = '$2' }) {
  const style = styles[value] || { bg: '$card', text: '$textMuted', label: value?.toUpperCase() || 'UNKNOWN' };
  
  return (
    <XStack 
      bg={style.bg} 
      px="$2.5" 
      py="$1" 
      br="$pill" 
      ai="center" 
      jc="center"
      borderWidth={1}
      borderColor="transparent"
    >
      <Text 
        color={style.text} 
        fontSize={10} 
        fontWeight="700" 
        letterSpacing={0.5}
      >
        {style.label}
      </Text>
    </XStack>
  );
}
