import React, { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INK, PAPER, SPRING } from '../theme';
import { Pressy } from '../ui/kit';

// One bottom sheet for everything (edit, settings, paywall). Springs up,
// drags down to dismiss, dims what's behind it.

export function Sheet({
  visible,
  onClose,
  children,
  maxHeightRatio = 0.9,
  scroll = true,
  footer,
}: {
  visible: boolean;
  onClose(): void;
  children: React.ReactNode;
  maxHeightRatio?: number;
  scroll?: boolean;
  /** Pinned to the bottom (e.g. the paywall CTA), never scrolls away. */
  footer?: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(height);
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = withSpring(0, SPRING);
    } else if (mounted) {
      y.value = withTiming(height, { duration: 240 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, height, y, mounted]);

  const drag = Gesture.Pan()
    .activeOffsetY(12)
    .onChange((e) => {
      y.value = Math.max(0, y.value + e.changeY);
    })
    .onEnd((e) => {
      if (y.value > 120 || e.velocityY > 900) runOnJS(onClose)();
      else y.value = withSpring(0, SPRING);
    });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: 0.4 * (1 - Math.min(1, y.value / height)) }));

  if (!mounted) return null;

  const body = scroll ? (
    <ScrollView contentContainerStyle={{ paddingBottom: footer ? 12 : insets.bottom + 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: INK }, scrim]}>
        <Pressy style={StyleSheet.absoluteFill} onPress={onClose} hapticKind="none" scaleTo={1} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { maxHeight: height * maxHeightRatio }, sheet]}>
          <GestureDetector gesture={drag}>
            <View style={styles.grabZone}>
              <View style={styles.grabber} />
            </View>
          </GestureDetector>
          {body}
          {footer ? <View style={{ paddingBottom: Math.max(insets.bottom, 16) }}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: PAPER,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 2.5,
    borderBottomWidth: 0,
    borderColor: INK,
    paddingHorizontal: 22,
  },
  grabZone: { alignItems: 'center', paddingVertical: 10 },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(43,35,80,0.2)' },
});
