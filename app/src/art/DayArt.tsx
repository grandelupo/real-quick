import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, cancelAnimation } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { FoodGlyph } from './Foods';
import { DAYS, INK, NIGHT_BG } from '../theme';

// The background world of one day page. Food doodles in the weekday's
// pastel by day; a white sheet with a soft line landscape at night.

interface Slot {
  x: number; // 0…1 of width
  y: number; // 0…1 of height
  s: number; // size, fraction of width
  r: number; // rotation
  f: 0 | 1 | 2; // which of the day's three foods
}

// Hand-placed so the middle band (the numbers) stays calm.
const SLOTS: Slot[] = [
  { x: 0.04, y: 0.07, s: 0.2, r: -14, f: 0 },
  { x: 0.74, y: 0.04, s: 0.17, r: 18, f: 1 },
  { x: 0.42, y: 0.13, s: 0.1, r: 30, f: 2 },
  { x: -0.04, y: 0.32, s: 0.15, r: 12, f: 2 },
  { x: 0.86, y: 0.27, s: 0.16, r: -22, f: 0 },
  { x: 0.82, y: 0.52, s: 0.13, r: 9, f: 1 },
  { x: 0.0, y: 0.6, s: 0.17, r: -8, f: 1 },
  { x: 0.18, y: 0.74, s: 0.11, r: 24, f: 0 },
  { x: 0.62, y: 0.7, s: 0.19, r: -16, f: 2 },
  { x: 0.36, y: 0.82, s: 0.14, r: 6, f: 1 },
];

function Bobbing({ children, delay, active }: { children: React.ReactNode; delay: number; active: boolean }) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(y);
      y.value = withTiming(0, { duration: 400 });
      return;
    }
    y.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(-6, { duration: 2200, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) })), -1),
    );
    return () => cancelAnimation(y);
  }, [active, delay, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function DayArt({ weekday, width, height, night, active }: { weekday: number; width: number; height: number; night: boolean; active: boolean }) {
  const p = DAYS[weekday];
  if (night) return <NightLandscape weekday={weekday} width={width} height={height} />;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: p.bg }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`day-${weekday}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.bg} stopOpacity={1} />
            <Stop offset="1" stopColor={p.bgDeep} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#day-${weekday})`} />
        <Circle cx={width * 0.85} cy={height * 0.12} r={width * 0.4} fill="#FFFFFF" opacity={0.22} />
        <Circle cx={width * 0.1} cy={height * 0.78} r={width * 0.45} fill="#FFFFFF" opacity={0.16} />
      </Svg>
      {SLOTS.map((s, i) => (
        <View key={i} style={{ position: 'absolute', left: s.x * width, top: s.y * height }}>
          <Bobbing delay={i * 260} active={active}>
            <FoodGlyph kind={p.foods[s.f]} tones={p.art} size={s.s * width} rotate={s.r} opacity={0.9} />
          </Bobbing>
        </View>
      ))}
    </View>
  );
}

export function NightLandscape({ weekday, width: w, height: h }: { weekday: number; width: number; height: number }) {
  const p = DAYS[weekday];
  const base = h * 0.7;
  const stars = [
    [0.12, 0.08], [0.3, 0.14], [0.52, 0.06], [0.66, 0.18], [0.9, 0.3], [0.2, 0.28], [0.78, 0.08], [0.42, 0.24],
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: NIGHT_BG }]} pointerEvents="none">
      <Svg width={w} height={h}>
        {/* moon */}
        <Circle cx={w * 0.8} cy={h * 0.15} r={w * 0.09} fill={p.art[0]} stroke={INK} strokeOpacity={0.35} strokeWidth={2.5} />
        <Circle cx={w * 0.84} cy={h * 0.135} r={w * 0.08} fill={NIGHT_BG} />
        {stars.map(([x, y], i) => (
          <Path
            key={i}
            d={`M${x * w} ${y * h - 5} L${x * w} ${y * h + 5} M${x * w - 5} ${y * h} L${x * w + 5} ${y * h}`}
            stroke={p.art[2]}
            strokeOpacity={0.6}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
        {/* far hills */}
        <Path
          d={`M0 ${base - h * 0.06} C ${w * 0.2} ${base - h * 0.14}, ${w * 0.38} ${base - h * 0.02}, ${w * 0.55} ${base - h * 0.08} S ${w * 0.85} ${base - h * 0.16}, ${w} ${base - h * 0.07} L ${w} ${h} L 0 ${h} Z`}
          fill={p.art[0]}
          stroke={INK}
          strokeOpacity={0.18}
          strokeWidth={2}
        />
        {/* near hills */}
        <Path
          d={`M0 ${base + h * 0.04} C ${w * 0.25} ${base - h * 0.04}, ${w * 0.45} ${base + h * 0.06}, ${w * 0.7} ${base + h * 0.01} S ${w * 0.95} ${base + h * 0.02}, ${w} ${base + h * 0.05} L ${w} ${h} L 0 ${h} Z`}
          fill={p.art[1]}
          fillOpacity={0.45}
          stroke={INK}
          strokeOpacity={0.2}
          strokeWidth={2}
        />
        {/* little house with a lit window */}
        <Path
          d={`M${w * 0.18} ${base + h * 0.005} l0 -${h * 0.035} l${w * 0.045} -${h * 0.028} l${w * 0.045} ${h * 0.028} l0 ${h * 0.035} Z`}
          fill="#FFFFFF"
          stroke={INK}
          strokeOpacity={0.4}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Rect x={w * 0.212} y={base - h * 0.02} width={w * 0.026} height={w * 0.026} rx={2} fill="#FFD66B" />
        {/* trees */}
        {[0.62, 0.68, 0.86].map((x, i) => (
          <Path
            key={i}
            d={`M${x * w} ${base + h * 0.03 - i * 4} l-${w * 0.025} 0 l${w * 0.025} -${h * 0.06} l${w * 0.025} ${h * 0.06} Z`}
            fill={p.art[2]}
            fillOpacity={0.5}
            stroke={INK}
            strokeOpacity={0.3}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
}
