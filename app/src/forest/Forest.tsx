import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { PixelRatio, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { DeviceMotion } from 'expo-sensors';
import type { SharedValue } from 'react-native-reanimated';
import { ForestScene } from './scene';

// The living forest band at the bottom of the home screen. One GL scene for
// the whole app: the day's biome, how far it has grown today, whether it has
// overgrown, and the night look all come in as props and ease over. Changing
// day is a roll of the planet, driven by the `roll` shared value (0…1) between
// beginRoll() and commitRoll()/cancelRoll() on the handle.

interface Props {
  width: number;
  height: number;
  weekday: number;
  /** 0…1 of the daily goal. */
  growth: number;
  /** 0…1 how far past the goal (0 at ≤105%, 1 at ≥155%). */
  over: number;
  night: boolean;
  /** False while the app is in the background: the loop stops. */
  active: boolean;
  /** Progress of the current day roll, 0…1; read every frame. */
  roll: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}

export interface ForestHandle {
  beginRoll(dir: 1 | -1, weekday: number, growth: number, over: number): void;
  commitRoll(): void;
  cancelRoll(): void;
}

export const Forest = forwardRef<ForestHandle, Props>(function Forest({ width, height, weekday, growth, over, night, active, roll, style }, ref) {
  const scene = useRef<ForestScene | null>(null);
  const raf = useRef(0);
  const running = useRef(false);
  const rest = useRef<{ roll: number; pitch: number } | null>(null);
  const rolling = useRef(false);

  const loop = (now: number) => {
    if (!running.current) return;
    try {
      if (rolling.current) scene.current?.setRoll(roll.value);
      scene.current?.frame(now);
    } catch (e) {
      // a broken frame stops the forest, never the app
      console.warn('forest stopped', e);
      running.current = false;
      return;
    }
    raf.current = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running.current || !scene.current) return;
    running.current = true;
    raf.current = requestAnimationFrame(loop);
  };
  const stop = () => {
    running.current = false;
    cancelAnimationFrame(raf.current);
  };

  useImperativeHandle(ref, () => ({
    beginRoll(dir, wd, g, o) {
      scene.current?.beginRoll(dir, wd, g, o);
      rolling.current = true;
    },
    commitRoll() {
      rolling.current = false;
      scene.current?.commitRoll();
    },
    cancelRoll() {
      rolling.current = false;
      scene.current?.cancelRoll();
    },
  }));

  useEffect(() => {
    if (!rolling.current) scene.current?.setDay(weekday);
  }, [weekday]);
  useEffect(() => {
    scene.current?.setGrowth(growth, over);
  }, [growth, over]);
  useEffect(() => {
    scene.current?.setNight(night);
  }, [night]);
  useEffect(() => {
    if (active) start();
    else stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => {
    scene.current?.resize(width, height);
  }, [width, height]);

  // Tilt: the resting pose adapts slowly, so holding the phone at any angle
  // is neutral and only a change of angle moves the camera.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove(): void } | null = null;
    let alive = true;
    (async () => {
      try {
        if (!(await DeviceMotion.isAvailableAsync())) return;
        const perm = await DeviceMotion.requestPermissionsAsync().catch(() => ({ granted: true }));
        if (!perm.granted || !alive) return;
        DeviceMotion.setUpdateInterval(50);
      } catch {
        return; // no sensors: the forest just doesn't tilt
      }
      sub = DeviceMotion.addListener((m) => {
        const rot = m.rotation;
        if (!rot) return;
        const r = rot.gamma ?? 0;
        const pitch = rot.beta ?? 0;
        if (!rest.current) rest.current = { roll: r, pitch };
        rest.current.roll += (r - rest.current.roll) * 0.015;
        rest.current.pitch += (pitch - rest.current.pitch) * 0.015;
        scene.current?.setTilt(r - rest.current.roll, pitch - rest.current.pitch);
      });
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  useEffect(
    () => () => {
      stop();
      scene.current?.dispose();
      scene.current = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View pointerEvents="none" style={[styles.wrap, { width, height }, style]}>
      <GLView
        style={{ width, height }}
        msaaSamples={4}
        onContextCreate={(gl: ExpoWebGLRenderingContext) => {
          try {
            const s = new ForestScene(gl, width, height, PixelRatio.get());
            s.setDay(weekday, true);
            s.setGrowth(growth, over);
            s.setNight(night);
            scene.current = s;
            if (active) start();
          } catch (e) {
            console.warn('forest unavailable', e);
          }
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, bottom: 0 },
});
