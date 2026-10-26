import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { INK, type FoodKind } from '../theme';

// Soft pastel food doodles, all on a 100×100 canvas: flat fills, a rounded
// dark-navy line, and (on some) the house face — two oval dot eyes and blush.

type Tones = [string, string, string];

interface GlyphProps {
  t: Tones;
}

const line = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeOpacity: 0.55 };

function Face({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G opacity={0.75}>
      <Ellipse cx={x - 7 * s} cy={y} rx={1.9 * s} ry={2.6 * s} fill={INK} />
      <Ellipse cx={x + 7 * s} cy={y} rx={1.9 * s} ry={2.6 * s} fill={INK} />
      <Ellipse cx={x - 12 * s} cy={y + 5 * s} rx={3.4 * s} ry={2 * s} fill="#FF8FA8" opacity={0.6} />
      <Ellipse cx={x + 12 * s} cy={y + 5 * s} rx={3.4 * s} ry={2 * s} fill="#FF8FA8" opacity={0.6} />
      <Path d={`M${x - 2.5 * s} ${y + 4 * s} q${2.5 * s} ${2.4 * s} ${5 * s} 0`} {...line} strokeWidth={2.2} fill="none" />
    </G>
  );
}

const G_: Record<FoodKind, (p: GlyphProps) => React.JSX.Element> = {
  avocado: ({ t }) => (
    <>
      <Path d="M50 8 C30 8 22 40 20 58 C18 80 32 94 50 94 C68 94 82 80 80 58 C78 40 70 8 50 8Z" fill={t[2]} {...line} />
      <Path d="M50 18 C36 18 30 44 29 60 C28 76 38 86 50 86 C62 86 72 76 71 60 C70 44 64 18 50 18Z" fill={t[0]} />
      <Circle cx={50} cy={64} r={13} fill="#C99266" {...line} />
      <Face x={50} y={40} s={0.9} />
    </>
  ),
  pea: ({ t }) => (
    <>
      <Path d="M10 60 C25 30 75 30 90 40 C80 70 30 80 10 60Z" fill={t[2]} {...line} />
      <Circle cx={34} cy={52} r={8} fill={t[1]} />
      <Circle cx={52} cy={48} r={8} fill={t[1]} />
      <Circle cx={70} cy={45} r={7} fill={t[1]} />
    </>
  ),
  kiwi: ({ t }) => (
    <>
      <Circle cx={50} cy={50} r={38} fill="#B08463" {...line} />
      <Circle cx={50} cy={50} r={31} fill={t[1]} />
      <Circle cx={50} cy={50} r={10} fill={t[0]} />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <Ellipse key={i} cx={50 + Math.cos(a) * 18} cy={50 + Math.sin(a) * 18} rx={1.6} ry={2.6} fill={INK} opacity={0.6} />;
      })}
    </>
  ),
  peach: ({ t }) => (
    <>
      <Path d="M50 22 C20 18 10 48 18 68 C26 88 50 92 50 92 C50 92 74 88 82 68 C90 48 80 18 50 22Z" fill={t[1]} {...line} />
      <Path d="M50 24 C46 40 46 70 50 90" {...line} fill="none" strokeOpacity={0.3} />
      <Path d="M52 22 C58 10 72 8 78 12 C72 22 60 24 52 22Z" fill="#8FCB8A" {...line} />
      <Face x={38} y={56} s={0.8} />
    </>
  ),
  croissant: ({ t }) => (
    <>
      <Path d="M8 66 C14 40 34 26 50 26 C66 26 86 40 92 66 C80 70 72 62 66 60 C60 70 40 70 34 60 C28 62 20 70 8 66Z" fill={t[1]} {...line} />
      <Path d="M34 60 C36 46 42 36 50 34" {...line} fill="none" strokeOpacity={0.35} />
      <Path d="M66 60 C64 46 58 36 50 34" {...line} fill="none" strokeOpacity={0.35} />
    </>
  ),
  carrot: ({ t }) => (
    <>
      <Path d="M40 30 L60 30 L52 92 Q50 96 48 92Z" fill={t[2]} {...line} />
      <Path d="M44 46 L52 46 M46 62 L54 62" {...line} strokeOpacity={0.35} />
      <Path d="M50 30 C44 18 38 12 34 10 M50 30 C50 18 52 10 54 6 M50 30 C56 20 62 14 68 12" stroke="#7CC47A" strokeWidth={5} strokeLinecap="round" fill="none" />
    </>
  ),
  grapes: ({ t }) => (
    <>
      {[[38, 30], [58, 30], [28, 48], [48, 48], [68, 48], [38, 66], [58, 66], [48, 82]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={11} fill={i % 2 ? t[1] : t[2]} {...line} />
      ))}
      <Path d="M48 20 C48 12 52 8 58 6" {...line} fill="none" />
    </>
  ),
  plum: ({ t }) => (
    <>
      <Circle cx={50} cy={56} r={34} fill={t[2]} {...line} />
      <Ellipse cx={38} cy={42} rx={8} ry={5} fill={t[0]} opacity={0.7} />
      <Path d="M50 22 C52 14 58 10 64 10" {...line} fill="none" />
      <Face x={52} y={60} s={0.85} />
    </>
  ),
  macaron: ({ t }) => (
    <>
      <Rect x={14} y={30} width={72} height={20} rx={10} fill={t[1]} {...line} />
      <Rect x={18} y={48} width={64} height={8} rx={4} fill="#FFF8F0" {...line} />
      <Rect x={14} y={54} width={72} height={20} rx={10} fill={t[1]} {...line} />
    </>
  ),
  banana: ({ t }) => (
    <>
      <Path d="M18 30 C20 70 54 90 86 70 C88 66 86 62 82 64 C58 76 34 62 30 30 C28 24 18 24 18 30Z" fill={t[1]} {...line} />
      <Path d="M18 28 L16 20" {...line} strokeWidth={5} />
      <Face x={52} y={62} s={0.75} />
    </>
  ),
  lemon: ({ t }) => (
    <>
      <Ellipse cx={50} cy={52} rx={38} ry={28} fill={t[1]} {...line} />
      <Path d="M12 52 L6 50 M88 52 L94 50" {...line} strokeWidth={4} />
      <Face x={50} y={50} s={0.85} />
    </>
  ),
  egg: ({ t }) => (
    <>
      <Path d="M50 14 C70 14 90 34 88 56 C86 78 70 88 50 88 C28 88 12 76 12 56 C12 34 30 14 50 14Z" fill="#FFFFFF" {...line} />
      <Circle cx={52} cy={54} r={18} fill={t[2]} />
      <Ellipse cx={46} cy={48} rx={5} ry={3.5} fill="#FFFFFF" opacity={0.7} />
    </>
  ),
  strawberry: ({ t }) => (
    <>
      <Path d="M50 92 C30 82 14 60 18 40 C22 26 38 24 50 30 C62 24 78 26 82 40 C86 60 70 82 50 92Z" fill={t[2]} {...line} />
      <Path d="M30 28 L42 20 L50 28 L58 20 L70 28 C60 34 40 34 30 28Z" fill="#8FCB8A" {...line} />
      {[[36, 48], [56, 46], [44, 62], [64, 60], [50, 76], [30, 62]].map(([x, y], i) => (
        <Ellipse key={i} cx={x} cy={y} rx={1.6} ry={2.4} fill="#FFF3C4" />
      ))}
    </>
  ),
  donut: ({ t }) => (
    <>
      <Circle cx={50} cy={50} r={38} fill="#E9B98A" {...line} />
      <Path d="M18 46 C20 24 40 14 54 14 C74 16 88 32 86 52 C80 50 76 58 70 56 C64 54 60 62 52 60 C44 58 40 66 32 62 C26 58 22 50 18 46Z" fill={t[1]} />
      <Circle cx={50} cy={50} r={12} fill="none" {...line} />
      {[[30, 34], [60, 26], [72, 42], [40, 24], [26, 50]].map(([x, y], i) => (
        <Rect key={i} x={x} y={y} width={7} height={3} rx={1.5} fill={['#FFF', '#7FC7F5', '#FFE070'][i % 3]} transform={`rotate(${i * 37} ${x} ${y})`} />
      ))}
    </>
  ),
  cherry: ({ t }) => (
    <>
      <Path d="M36 62 C40 40 50 22 66 10 M64 60 C64 40 64 24 66 10" {...line} fill="none" stroke="#6D9A5B" strokeOpacity={0.9} />
      <Circle cx={34} cy={70} r={16} fill={t[2]} {...line} />
      <Circle cx={66} cy={68} r={16} fill={t[2]} {...line} />
      <Ellipse cx={28} cy={64} rx={4} ry={2.5} fill="#FFFFFF" opacity={0.7} />
      <Ellipse cx={60} cy={62} rx={4} ry={2.5} fill="#FFFFFF" opacity={0.7} />
    </>
  ),
  blueberry: ({ t }) => (
    <>
      <Circle cx={50} cy={52} r={34} fill={t[2]} {...line} />
      <Path d="M42 28 L50 34 L58 28 L56 38 L44 38Z" fill={t[0]} {...line} strokeWidth={2} />
      <Face x={50} y={56} s={0.85} />
    </>
  ),
  icecream: ({ t }) => (
    <>
      <Path d="M32 50 L50 94 L68 50Z" fill="#F2C994" {...line} />
      <Path d="M38 56 L62 72 M60 56 L42 74" {...line} strokeOpacity={0.3} />
      <Path d="M26 50 C20 34 32 18 50 18 C68 18 80 34 74 50 C68 54 60 50 56 54 C50 58 44 52 38 54 C32 56 28 54 26 50Z" fill={t[1]} {...line} />
      <Face x={50} y={36} s={0.75} />
    </>
  ),
  cupcake: ({ t }) => (
    <>
      <Path d="M24 54 L32 90 L68 90 L76 54Z" fill={t[0]} {...line} />
      <Path d="M38 56 L42 88 M50 56 L50 88 M62 56 L58 88" {...line} strokeOpacity={0.3} />
      <Path d="M20 54 C14 40 28 26 40 28 C44 16 60 14 66 26 C80 26 88 42 80 54Z" fill={t[1]} {...line} />
      <Circle cx={54} cy={16} r={6} fill="#FF7F8E" {...line} />
    </>
  ),
  pizza: ({ t }) => (
    <>
      <Path d="M50 92 L14 22 C36 10 64 10 86 22Z" fill="#FFD77A" {...line} />
      <Path d="M14 22 C36 10 64 10 86 22 L82 30 C62 20 38 20 18 30Z" fill="#E8A86A" {...line} />
      <Circle cx={42} cy={40} r={7} fill="#FF8C7A" />
      <Circle cx={60} cy={48} r={6} fill="#FF8C7A" />
      <Circle cx={48} cy={62} r={5} fill="#FF8C7A" />
      <Ellipse cx={58} cy={34} rx={4} ry={2.5} fill={t[2]} />
    </>
  ),
  tomato: ({ t }) => (
    <>
      <Circle cx={50} cy={56} r={34} fill="#FF8C7A" {...line} />
      <Path d="M36 26 L44 30 L50 20 L56 30 L64 26 L58 36 L42 36Z" fill={t[2]} {...line} />
      <Face x={50} y={60} s={0.85} />
    </>
  ),
  pear: ({ t }) => (
    <>
      <Path d="M50 18 C40 18 38 34 34 44 C24 56 22 72 30 82 C38 92 62 92 70 82 C78 72 76 56 66 44 C62 34 60 18 50 18Z" fill={t[1]} {...line} />
      <Path d="M50 18 C50 12 52 8 56 6" {...line} fill="none" />
      <Face x={50} y={64} s={0.8} />
    </>
  ),
};

export function FoodGlyph({ kind, tones, size, rotate = 0, opacity = 1 }: { kind: FoodKind; tones: Tones; size: number; rotate?: number; opacity?: number }) {
  const Glyph = G_[kind];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: [{ rotate: `${rotate}deg` }], opacity }}>
      <Glyph t={tones} />
    </Svg>
  );
}

export const FOOD_KINDS = Object.keys(G_) as FoodKind[];
