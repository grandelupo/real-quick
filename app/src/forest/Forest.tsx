import React, { useEffect, useRef } from 'react';
import { PixelRatio, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { DeviceMotion } from 'expo-sensors';
import { ForestScene } from './scene';

// The living forest band at the bottom of the home screen. One GL scene for
// the whole app: the day's biome, how far it has grown today, whether it has
// overgrown, and the night look all come in as props and ease over.

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
  style?: StyleProp<ViewStyle>;
}

export function Forest({ width, height, weekday, growth, over, night, active, style }: Props) {
  const scene = useRef<ForestScene | null>(null);
  const raf = useRef(0);
  const running = useRef(false);
  const rest = useRef<{ roll: number; pitch: number } | null>(null);

  const loop = (now: number) => {
    if (!running.current) return;
    scene.current?.frame(now);
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

  useEffect(() => {
    scene.current?.setDay(weekday);
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
    void DeviceMotion.isAvailableAsync().then((ok) => {
      if (!ok || !alive) return;
      DeviceMotion.setUpdateInterval(50);
      sub = DeviceMotion.addListener((m) => {
        const rot = m.rotation;
        if (!rot) return;
        const roll = rot.gamma ?? 0;
        const pitch = rot.beta ?? 0;
        if (!rest.current) rest.current = { roll, pitch };
        rest.current.roll += (roll - rest.current.roll) * 0.015;
        rest.current.pitch += (pitch - rest.current.pitch) * 0.015;
        scene.current?.setTilt(roll - rest.current.roll, pitch - rest.current.pitch);
      });
    });
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
          const s = new ForestScene(gl, width, height, PixelRatio.get());
          s.setDay(weekday, true);
          s.setGrowth(growth, over);
          s.setNight(night);
          scene.current = s;
          if (active) start();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, bottom: 0 },
});
