import React from 'react';
import { Card, View } from 'tamagui';
import { radius, usePalette } from '../theme';

export function SurfaceCard({ children, style, tone = 'panel' }) {
  const colors = usePalette();
  const isPanel = tone === 'panel';

  return (
    <Card
      style={[
        {
          borderWidth: 1,
          borderRadius: radius.lg,
          overflow: 'hidden',
          backgroundColor: isPanel ? colors.panel : colors.card,
          borderColor: isPanel ? colors.panelBorder : colors.cardBorder,
        },
        style,
      ]}
    >
      <View
        style={{
          height: 1,
          backgroundColor: isPanel ? '#38bdf866' : '#22d3ee33',
        }}
      />
      {children}
    </Card>
  );
}
