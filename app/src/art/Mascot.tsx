import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { INK } from '../theme';

// "Slice" — the Real Quick mascot: a pizza that is also a pie chart of the
// day's macros. One wedge is pulled out, the way you'd grab a slice.

export type Pose = 'happy' | 'wave' | 'think' | 'sleep' | 'wow';

function wedge(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

export function Mascot({ size, pose = 'happy', split = [0.25, 0.45, 0.3] }: { size: number; pose?: Pose; split?: [number, number, number] }) {
  const cx = 50;
  const cy = 52;
  const r = 34;
  const total = split[0] + split[1] + split[2] || 1;
  const fr = split.map((v) => v / total);
  const start = -Math.PI / 2 - 0.35;
  const a = [start, start + fr[0] * Math.PI * 2, start + (fr[0] + fr[1]) * Math.PI * 2, start + Math.PI * 2];
  // Pastel wedges like the app icon (protein · carbs · fat).
  const colors = ['#FF8E86', '#FFC9AE', '#FFE08A'];
  const pulled = 0; // the protein wedge pops out
  const mid = (a[pulled] + a[pulled + 1]) / 2;
  const off = 5;
  const line = { stroke: INK, strokeWidth: 3.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

  const eyes = (() => {
    switch (pose) {
      case 'sleep':
        return (
          <>
            <Path d="M40 63 q3.5 2.5 7 0" fill="none" {...line} strokeWidth={2.4} />
            <Path d="M53 63 q3.5 2.5 7 0" fill="none" {...line} strokeWidth={2.4} />
          </>
        );
      case 'think':
        return (
          <>
            <Ellipse cx={45} cy={61} rx={2.4} ry={3.2} fill={INK} />
            <Ellipse cx={59} cy={61} rx={2.4} ry={3.2} fill={INK} />
          </>
        );
      default:
        return (
          <>
            <Ellipse cx={43.5} cy={63} rx={2.5} ry={3.4} fill={INK} />
            <Ellipse cx={56.5} cy={63} rx={2.5} ry={3.4} fill={INK} />
          </>
        );
    }
  })();

  const mouth =
    pose === 'wow' ? <Ellipse cx={50} cy={70} rx={2.8} ry={3.3} fill={INK} /> :
    pose === 'sleep' ? <Path d="M48 70 q2 1.2 4 0" fill="none" {...line} strokeWidth={2.2} /> :
    pose === 'think' ? <Path d="M47 70 l6 -1" fill="none" {...line} strokeWidth={2.2} /> :
    <Path d="M47 68 q3 3.4 6 0" fill="none" {...line} strokeWidth={2.4} />;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* crust */}
      <Circle cx={cx} cy={cy} r={r + 7} fill="#F2C38A" {...line} />
      {[0, 1, 2].map((i) => {
        const dx = i === pulled ? Math.cos(mid) * off : 0;
        const dy = i === pulled ? Math.sin(mid) * off : 0;
        return (
          <G key={i} transform={`translate(${dx} ${dy})`}>
            <Path d={wedge(cx, cy, r, a[i], a[i + 1])} fill={colors[i]} {...line} strokeWidth={2.6} />
          </G>
        );
      })}
      {/* toppings */}
      <Circle cx={60} cy={34} r={3} fill="#FFFFFF" opacity={0.6} />
      <Circle cx={70} cy={46} r={2.4} fill="#FFFFFF" opacity={0.6} />
      <Circle cx={33} cy={44} r={2.8} fill="#FFFFFF" opacity={0.6} />
      {/* face */}
      {eyes}
      <Ellipse cx={38} cy={68} rx={3.6} ry={2.2} fill="#FF7FA0" opacity={0.75} />
      <Ellipse cx={62} cy={68} rx={3.6} ry={2.2} fill="#FF7FA0" opacity={0.75} />
      {mouth}
      {pose === 'wave' && <Path d="M88 40 q6 -8 2 -16 M86 34 l6 -4" fill="none" {...line} />}
      {pose === 'sleep' && <Path d="M80 18 h7 l-7 8 h7" fill="none" {...line} strokeWidth={2.4} />}
      {pose === 'think' && (
        <>
          <Circle cx={84} cy={22} r={3} fill="#FFFFFF" {...line} strokeWidth={2} />
          <Circle cx={91} cy={12} r={4.5} fill="#FFFFFF" {...line} strokeWidth={2} />
        </>
      )}
    </Svg>
  );
}
