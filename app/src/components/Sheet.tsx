import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INK, PAPER, SHADOW } from '../theme';
import { TIMING, TIMING_SLOW } from '../ui/motion';
import { Pressy } from '../ui/kit';

// One bottom sheet for everything (edit, settings, paywall). Eases up,
// drags down to dismiss, dims what's behind it. The content scrolls only
// when it really overflows the sheet or the keyboard is up; otherwise a
// drag anywhere on the sheet is the dismiss gesture, like a system sheet.

/** True while the software keyboard is up. */
function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return up;
}

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
  const [contentH, setContentH] = useState(0);
  const [frameH, setFrameH] = useState(0);
  const keyboardUp = useKeyboardUp();
  const overflows = contentH > frameH + 1;
  const scrolls = scroll && (overflows || keyboardUp);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = withTiming(0, TIMING_SLOW);
    } else if (mounted) {
      y.value = withTiming(height, TIMING, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, height, y, mounted]);

  const dismiss = () => {
    Keyboard.dismiss();
    onClose();
  };
  const pan = () =>
    Gesture.Pan()
      .activeOffsetY(12)
      .failOffsetX([-16, 16])
      .onChange((e) => {
        y.value = Math.max(0, y.value + e.changeY);
      })
      .onEnd((e) => {
        if (y.value > 120 || e.velocityY > 900) runOnJS(dismiss)();
        else y.value = withTiming(0, TIMING);
      });
  // the grabber always drags; the body too while nothing inside it scrolls
  const grabDrag = pan();
  const bodyDrag = pan().enabled(!scrolls);

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: 0.32 * (1 - Math.min(1, y.value / height)) }));

  if (!mounted) return null;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={{ paddingBottom: footer ? 12 : insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrolls}
      bounces={scrolls}
      onContentSizeChange={(_, h) => setContentH(h)}
      onLayout={(e) => setFrameH(e.nativeEvent.layout.height)}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: INK }, scrim]}>
        <Pressy style={StyleSheet.absoluteFill} onPress={dismiss} hapticKind="none" scaleTo={1} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, SHADOW, { maxHeight: height * maxHeightRatio }, sheet]}>
          <GestureDetector gesture={grabDrag}>
            <View style={styles.grabZone}>
              <View style={styles.grabber} />
            </View>
          </GestureDetector>
          <GestureDetector gesture={bodyDrag}>
            <View style={styles.body}>
              {body}
              {footer ? <View style={{ paddingBottom: Math.max(insets.bottom, 16) }}>{footer}</View> : null}
            </View>
          </GestureDetector>
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
    paddingHorizontal: 22,
  },
  body: { flexShrink: 1 },
  grabZone: { alignItems: 'center', paddingVertical: 10 },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(43,35,80,0.16)' },
});
