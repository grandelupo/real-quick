import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ABS, RADIUS, SHADOW, SURFACE } from '../theme';

// A white surface resting on the page: soft wide shadow, a hairline of
// light along the top edge, no outline. Cards, chips and the bar share it.

export function Card({ style, children, radius = RADIUS.lg, tint = SURFACE }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode; radius?: number; tint?: string }) {
  return (
    <View style={[styles.card, SHADOW, { borderRadius: radius, backgroundColor: tint }, style]}>
      <View pointerEvents="none" style={[styles.edge, { borderRadius: radius }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'visible' },
  edge: { ...ABS, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', borderBottomColor: 'rgba(43,35,80,0.04)' },
});
