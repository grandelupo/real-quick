import React from 'react';
import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { FONT, INK } from '../theme';
import { getState } from '../store';

// Tiny shared kit: branded text and a squishy pressable. Everything tappable
// in the app goes through Pressy so it springs and ticks the same way.

type Variant = 'hero' | 'title' | 'h2' | 'body' | 'label' | 'small' | 'button';

const V: Record<Variant, TextStyle> = {
  hero: { fontFamily: FONT.displayBold, fontSize: 64, lineHeight: 70, letterSpacing: -1 },
  title: { fontFamily: FONT.display, fontSize: 30, lineHeight: 36 },
  h2: { fontFamily: FONT.display, fontSize: 21, lineHeight: 26 },
  body: { fontFamily: FONT.body, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: FONT.bodyBold, fontSize: 14, lineHeight: 18 },
  small: { fontFamily: FONT.body, fontSize: 13, lineHeight: 17 },
  button: { fontFamily: FONT.display, fontSize: 18, lineHeight: 22 },
};

export function T({ v = 'body', style, color = INK, ...rest }: TextProps & { v?: Variant; color?: string }) {
  return <Text {...rest} style={[V[v], { color, fontVariant: ['tabular-nums'] }, style]} />;
}

export type HapticKind = 'light' | 'medium' | 'success' | 'warning' | 'none';

export function haptic(kind: HapticKind = 'light') {
  if (kind === 'none' || !getState().settings.haptics) return;
  try {
    if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else void Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // web / unsupported device
  }
}

const APressable = Animated.createAnimatedComponent(Pressable);

export function Pressy({
  style,
  children,
  onPress,
  hapticKind = 'light',
  scaleTo = 0.94,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; hapticKind?: HapticKind; scaleTo?: number; children?: React.ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      onPressIn={(e) => {
        s.value = withSpring(scaleTo, { damping: 15, stiffness: 400 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, { damping: 12, stiffness: 300 });
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        haptic(hapticKind);
        onPress?.(e);
      }}
      style={[style, a]}
    >
      {children}
    </APressable>
  );
}

export const kit = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
