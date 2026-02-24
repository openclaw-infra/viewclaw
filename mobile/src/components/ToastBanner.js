import React from 'react';
import { XStack, Text } from 'tamagui';
import { Ionicons } from '@expo/vector-icons';

export function ToastBanner({ text, type = 'info' }) {
  if (!text) return null;

  const config = {
    error: { bg: '$dangerBg', text: '$dangerText', icon: 'alert-circle-outline' },
    success: { bg: '$successBg', text: '$successText', icon: 'checkmark-circle-outline' },
    info: { bg: '$primaryBg', text: '$primaryText', icon: 'information-circle-outline' },
  };

  const style = config[type] || config.info;

  return (
    <XStack 
      bg={style.bg} 
      px="$3" 
      py="$2.5" 
      br="$3" 
      mb="$3" 
      ai="center" 
      gap="$2"
      animation="quick"
      enterStyle={{ opacity: 0, y: -10 }}
    >
      <Ionicons name={style.icon} size={16} color={style.text} />
      <Text color={style.text} fontWeight="600" fontSize="$3">{text}</Text>
    </XStack>
  );
}
