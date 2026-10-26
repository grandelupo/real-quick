import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { INK, INK_FAINT, INK_SOFT, SHADOW, SURFACE } from '../theme';
import { EASE_OUT } from '../ui/motion';
import { CheckIcon } from '../ui/Icons';
import { Pressy, T } from '../ui/kit';

export interface ToastMsg {
  text: string;
  sub?: string;
  action?: { label: string; run(): void };
}

export function useToast() {
  const [msg, setMsg] = useState<(ToastMsg & { key: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: ToastMsg) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg({ ...m, key: Date.now() });
    timer.current = setTimeout(() => setMsg(null), m.action ? 5000 : 2300);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { msg, show, hide: () => setMsg(null) };
}

export function Toast({ msg, bottom }: { msg: (ToastMsg & { key: number }) | null; bottom: number }) {
  if (!msg) return null;
  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <Animated.View
        key={msg.key}
        entering={FadeInDown.duration(260).easing(EASE_OUT)}
        exiting={FadeOutDown.duration(180)}
        style={[styles.toast, SHADOW]}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.mark}>
          <CheckIcon size={18} color={INK} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="label">{msg.text}</T>
          {msg.sub ? (
            <T v="small" color={INK_SOFT}>
              {msg.sub}
            </T>
          ) : null}
        </View>
        {msg.action ? (
          <Pressy onPress={msg.action.run} style={styles.action}>
            <T v="label">{msg.action.label}</T>
          </Pressy>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    maxWidth: 460,
    width: '100%',
  },
  mark: { width: 34, height: 34, borderRadius: 17, backgroundColor: INK_FAINT, alignItems: 'center', justifyContent: 'center' },
  action: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: INK_FAINT },
});
