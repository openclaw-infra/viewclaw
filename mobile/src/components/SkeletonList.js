import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, usePalette } from '../theme';

export function SkeletonList({ count = 3 }) {
  const colors = usePalette();
  const styles = getStyles(colors);

  return (
    <View style={styles.wrap}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.item} />
      ))}
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    wrap: {
      gap: 10,
    },
    item: {
      height: 78,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.panelBorder,
      borderRadius: radius.md,
      opacity: 0.75,
    },
  });
}
