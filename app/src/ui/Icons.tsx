import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { INK } from '../theme';

// Hand-drawn-feeling line icons, 24×24, round caps — matched to the doodles.

interface P {
  size?: number;
  color?: string;
  stroke?: number;
}

const base = (color: string, stroke: number) => ({ stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });

export function CameraIcon({ size = 24, color = INK, stroke = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 8.5C4 7.4 4.9 6.5 6 6.5h1.8l1.3-2h5.8l1.3 2H18c1.1 0 2 .9 2 2V17c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V8.5Z" {...base(color, stroke)} />
      <Circle cx={12} cy={12.6} r={3.6} {...base(color, stroke)} />
      <Circle cx={17.2} cy={9.4} r={0.6} fill={color} />
    </Svg>
  );
}

export function CogIcon({ size = 24, color = INK, stroke = 2.1 }: P) {
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const x1 = 12 + Math.cos(a) * 7.2;
    const y1 = 12 + Math.sin(a) * 7.2;
    const x2 = 12 + Math.cos(a) * 9.4;
    const y2 = 12 + Math.sin(a) * 9.4;
    return `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }).join('');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={6.4} {...base(color, stroke)} />
      <Circle cx={12} cy={12} r={2.4} {...base(color, stroke)} />
      <Path d={teeth} {...base(color, stroke + 0.8)} />
    </Svg>
  );
}

export function ShareIcon({ size = 24, color = INK, stroke = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3.5v11M8 7.2 12 3.5l4 3.7" {...base(color, stroke)} />
      <Path d="M7.5 10.5H6.5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2v-6c0-1.1-.9-2-2-2h-1" {...base(color, stroke)} />
    </Svg>
  );
}

export function HeartIcon({ size = 24, color = INK, fill = 'none' }: P & { fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" stroke={color} strokeWidth={2.1} strokeLinejoin="round" fill={fill} />
    </Svg>
  );
}

export function CloseIcon({ size = 24, color = INK, stroke = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...base(color, stroke)} />
    </Svg>
  );
}

export function PlusIcon({ size = 24, color = INK, stroke = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" {...base(color, stroke)} />
    </Svg>
  );
}

export function TrashIcon({ size = 24, color = INK, stroke = 2.1 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 7h14M10 4h4M7 7l.8 11.2c.1 1 .9 1.8 2 1.8h4.4c1.1 0 1.9-.8 2-1.8L17 7" {...base(color, stroke)} />
    </Svg>
  );
}

export function NotesIcon({ size = 24, color = INK, stroke = 2.1 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={5} y={3.5} width={14} height={17} rx={3} {...base(color, stroke)} />
      <Path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" {...base(color, stroke)} />
    </Svg>
  );
}

export function ChevronIcon({ size = 24, color = INK, stroke = 2.4, dir = 'left' }: P & { dir?: 'left' | 'right' | 'up' | 'down' }) {
  const rot = { left: 0, up: 90, right: 180, down: 270 }[dir];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: [{ rotate: `${rot}deg` }] }}>
      <Path d="M14.5 6 8.5 12l6 6" {...base(color, stroke)} />
    </Svg>
  );
}

export function SendIcon({ size = 24, color = INK, stroke = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" {...base(color, stroke)} />
    </Svg>
  );
}

export function CheckIcon({ size = 24, color = INK, stroke = 2.6 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5.5 12.5l4.2 4.2 8.8-9.4" {...base(color, stroke)} />
    </Svg>
  );
}

export function RetryIcon({ size = 24, color = INK, stroke = 2.2 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M19 12a7 7 0 1 1-2.1-5M17.5 3.8v3.6h-3.6" {...base(color, stroke)} />
    </Svg>
  );
}

export function LockIcon({ size = 24, color = INK, stroke = 2.1 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={5} y={10.5} width={14} height={10} rx={3} {...base(color, stroke)} />
      <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...base(color, stroke)} />
    </Svg>
  );
}
