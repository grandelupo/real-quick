import React from 'react';
import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { FONT, INK } from '../theme';
import { getState } from '../store';
import { TIMING_FAST } from './motion';

// Tiny shared kit: branded text and a quiet pressable. Everything tappable
// in the app goes through Pressy so it dims and ticks the same way.

type Variant = 'hero' | 'title' | 'h2' | 'body' | 'label' | 'small' | 'button';

const V: Record<Variant, TextStyle> = {
  hero: { fontFamily: FONT.displayBold, fontSize: 64, lineHeight: 70, letterSpacing: -2.2 },
  title: { fontFamily: FONT.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  h2: { fontFamily: FONT.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: FONT.body, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: FONT.bodyBold, fontSize: 14, lineHeight: 18 },
  small: { fontFamily: FONT.body, fontSize: 13, lineHeight: 17 },
  button: { fontFamily: FONT.displayMedium, fontSize: 17, lineHeight: 22 },
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

/** Presses settle a touch smaller; release eases back. (Only scale, so a
 * caller's own opacity — e.g. a hidden button — is left alone.) */
export function Pressy({
  style,
  children,
  onPress,
  hapticKind = 'light',
  scaleTo = 0.97,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; hapticKind?: HapticKind; scaleTo?: number; children?: React.ReactNode }) {
  const down = useSharedValue(0);
  const a = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - scaleTo) * down.value }],
  }));
  return (
    <APressable
      {...rest}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      onPressIn={(e) => {
        down.value = withTiming(1, { duration: 90 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        down.value = withTiming(0, TIMING_FAST);
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
