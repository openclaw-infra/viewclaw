import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, usePalette } from '../theme';
import { SkeletonList } from './SkeletonList';
import { SurfaceCard } from './SurfaceCard';

export function ScreenShell({ title, subtitle, loading, error, children, right }) {
  const colors = usePalette();
  const styles = getStyles(colors);

  return (
    <View style={styles.root}>
      <SurfaceCard style={styles.headerCard}>
        <View style={styles.headerBody}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>{title}</Text>
            {right || null}
          </View>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </SurfaceCard>

      {loading ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={4} />
        </View>
      ) : (
        <>
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {children}
        </>
      )}
    </View>
  );
}

function getStyles(colors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      gap: spacing.md,
    },
    headerCard: {
      marginTop: 2,
    },
    headerBody: {
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 8,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    title: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 24,
      letterSpacing: 0.3,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 13,
    },
    loadingWrap: {
      marginTop: 2,
    },
    errorBox: {
      backgroundColor: '#3b1f2d',
      borderWidth: 1,
      borderColor: '#7f1d1d',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    errorText: {
      color: '#fecdd3',
      fontSize: 13,
    },
  });
}
