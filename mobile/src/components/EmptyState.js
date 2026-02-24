import React from 'react';
import { Button, Paragraph, YStack } from 'tamagui';

export function EmptyState({ title = '暂无数据', subtitle = '可以先创建一个任务', actionText, onAction }) {
  return (
    <YStack ai="center" jc="center" py="$6" gap="$2">
      <Paragraph color="white" fontWeight="700">{title}</Paragraph>
      <Paragraph color="$gray10">{subtitle}</Paragraph>
      {actionText && onAction ? <Button size="$2" onPress={onAction}>{actionText}</Button> : null}
    </YStack>
  );
}
