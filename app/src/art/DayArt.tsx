import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { DAYS, NIGHT_BG, NIGHT_DEEP } from '../theme';

// The backdrop of one day page: the weekday's pastel as a quiet vertical
// gradient with two large soft light orbs for depth. By night the same
// shape in off-white, with a pale moon and two soft hills.

export function DayArt({ weekday, width, height, night }: { weekday: number; width: number; height: number; night: boolean }) {
  if (night) return <NightArt weekday={weekday} width={width} height={height} />;
  const p = DAYS[weekday];
  const id = `d${weekday}`;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: p.bg }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.bg} />
            <Stop offset="1" stopColor={p.bgDeep} />
          </LinearGradient>
          <RadialGradient id={`${id}-o1`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={p.glow} stopOpacity={0.7} />
            <Stop offset="0.55" stopColor={p.glow} stopOpacity={0.22} />
            <Stop offset="1" stopColor={p.glow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}-o2`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={p.glow} stopOpacity={0.55} />
            <Stop offset="0.6" stopColor={p.glow} stopOpacity={0.14} />
            <Stop offset="1" stopColor={p.glow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}-deep`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={p.bgDeep} stopOpacity={0.9} />
            <Stop offset="1" stopColor={p.bgDeep} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${id}-bg)`} />
        <Circle cx={width * 0.88} cy={height * 0.1} r={width * 0.62} fill={`url(#${id}-o1)`} />
        <Circle cx={width * 0.06} cy={height * 0.74} r={width * 0.7} fill={`url(#${id}-o2)`} />
        <Circle cx={width * 0.5} cy={height * 0.5} r={width * 0.55} fill={`url(#${id}-deep)`} opacity={0.5} />
      </Svg>
    </View>
  );
}

export function NightArt({ weekday, width: w, height: h }: { weekday: number; width: number; height: number }) {
  const p = DAYS[weekday];
  const base = h * 0.72;
  const stars: [number, number, number][] = [
    [0.12, 0.1, 1.6], [0.3, 0.16, 1.1], [0.5, 0.07, 1.4], [0.66, 0.2, 1], [0.9, 0.3, 1.3], [0.2, 0.3, 1], [0.76, 0.09, 1.1], [0.42, 0.26, 1.2],
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: NIGHT_BG }]} pointerEvents="none">
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="n-bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={NIGHT_BG} />
            <Stop offset="1" stopColor={NIGHT_DEEP} />
          </LinearGradient>
          <RadialGradient id="n-moon" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={p.ringSoft} stopOpacity={0.5} />
            <Stop offset="0.35" stopColor={p.ringSoft} stopOpacity={0.22} />
            <Stop offset="1" stopColor={p.ringSoft} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="n-far" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.ringSoft} stopOpacity={0.28} />
            <Stop offset="1" stopColor={p.ringSoft} stopOpacity={0.08} />
          </LinearGradient>
          <LinearGradient id="n-near" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.ringSoft} stopOpacity={0.4} />
            <Stop offset="1" stopColor={p.ringSoft} stopOpacity={0.12} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill="url(#n-bg)" />
        <Circle cx={w * 0.8} cy={h * 0.14} r={w * 0.42} fill="url(#n-moon)" />
        <Circle cx={w * 0.8} cy={h * 0.14} r={w * 0.075} fill="#FFFFFF" opacity={0.9} />
        {stars.map(([x, y, r], i) => (
          <Circle key={i} cx={x * w} cy={y * h} r={r} fill={p.ring} opacity={0.35} />
        ))}
        <Path
          d={`M0 ${base - h * 0.05} C ${w * 0.2} ${base - h * 0.13}, ${w * 0.38} ${base - h * 0.01}, ${w * 0.55} ${base - h * 0.07} S ${w * 0.85} ${base - h * 0.15}, ${w} ${base - h * 0.06} L ${w} ${h} L 0 ${h} Z`}
          fill="url(#n-far)"
        />
        <Path
          d={`M0 ${base + h * 0.05} C ${w * 0.25} ${base - h * 0.03}, ${w * 0.45} ${base + h * 0.07}, ${w * 0.7} ${base + h * 0.02} S ${w * 0.95} ${base + h * 0.03}, ${w} ${base + h * 0.06} L ${w} ${h} L 0 ${h} Z`}
          fill="url(#n-near)"
        />
        <Ellipse cx={w * 0.5} cy={h} rx={w * 0.9} ry={h * 0.12} fill="#FFFFFF" opacity={0.35} />
      </Svg>
    </View>
  );
}
