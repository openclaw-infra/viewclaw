import React from 'react';
import { XStack, Text } from 'tamagui';
import { Info, CheckCircle, AlertCircle } from 'lucide-react-native';

export function ToastBanner({ text, type = 'info' }) {
  if (!text) return null;

  const config = {
    error: { bg: '$dangerBg', text: '$dangerText', icon: AlertCircle },
    success: { bg: '$successBg', text: '$successText', icon: CheckCircle },
    info: { bg: '$primaryBg', text: '$primaryText', icon: Info },
  };

  const style = config[type] || config.info;
  const Icon = style.icon;

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
      <Icon size={16} color={style.text} />
      <Text color={style.text} fontWeight="600" fontSize="$3">{text}</Text>
    </XStack>
  );
}
