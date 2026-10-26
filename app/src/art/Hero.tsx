import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { type HeroKind } from '../theme';

// The soft-3D objects (assets/art, matte clay renders cut out on alpha).
// One per weekday plus the camera. A faint contact shadow underneath makes
// them sit on the page instead of floating in front of it.

export type ArtKind = HeroKind | 'camera';

const ART: Record<ArtKind, ImageSourcePropType> = {
  avocado: require('../../assets/art/avocado.png'),
  peach: require('../../assets/art/peach.png'),
  grapes: require('../../assets/art/grapes.png'),
  lemon: require('../../assets/art/lemon.png'),
  strawberry: require('../../assets/art/strawberry.png'),
  blueberries: require('../../assets/art/blueberries.png'),
  pear: require('../../assets/art/pear.png'),
  camera: require('../../assets/art/camera.png'),
};

export function Hero({ kind, size, shadow = true, opacity = 1 }: { kind: ArtKind; size: number; shadow?: boolean; opacity?: number }) {
  const sw = size * 0.78;
  const sh = size * 0.16;
  return (
    <View style={{ width: size, height: size + (shadow ? sh * 0.5 : 0), opacity }} pointerEvents="none">
      {shadow && (
        <Svg width={size} height={sh} style={[styles.shadow, { top: size - sh * 0.45 }]}>
          <Defs>
            <RadialGradient id="hero-shadow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#2B2350" stopOpacity={0.16} />
              <Stop offset="0.6" stopColor="#2B2350" stopOpacity={0.06} />
              <Stop offset="1" stopColor="#2B2350" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={size / 2} cy={sh / 2} rx={sw / 2} ry={sh / 2} fill="url(#hero-shadow)" />
        </Svg>
      )}
      <Image source={ART[kind]} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', left: 0 },
});
