import React, { useState } from 'react';
import { StyleSheet, Switch, TextInput, View, type LayoutChangeEvent, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ABS, BLUSH_DEEP, FONT, INK, INK_FAINT, INK_HAIR, INK_SOFT, SHADOW_SM, SURFACE, shadowOf } from '../theme';
import { TIMING } from './motion';
import { Pressy, T, haptic } from './kit';
import { ChevronIcon } from './Icons';

// Branded controls: a segmented picker with a sliding white pill, a stepper,
// a toggle row, a text field and the clay button — enough for every setting.

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  testID,
  compact,
}: {
  options: { value: V; label: string; sub?: string }[];
  value: V;
  onChange(v: V): void;
  testID?: string;
  /** A small one, for a switch that sits beside a section title. */
  compact?: boolean;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = options.length ? w / options.length : 0;
  const pill = useAnimatedStyle(() => ({
    width: segW - 6,
    transform: [{ translateX: withTiming(idx * segW + 3, TIMING) }],
  }));
  const tall = options.some((o) => o.sub);
  // One type size for the whole control. `adjustsFontSizeToFit` shrank each
  // segment on its own — on Android that left "Lose", "Maintain" and "Gain"
  // at three different sizes — so the longest label sets the size and every
  // segment uses it. 0.58em is about Plus Jakarta Sans' average advance.
  const longest = options.reduce((m, o) => Math.max(m, o.label.length), 1);
  const fontSize = segW > 0 ? Math.max(11, Math.min(14, (segW - 14) / (longest * 0.58))) : 14;
  return (
    <View style={[styles.seg, compact && styles.segCompact, tall && { height: 62 }]} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} testID={testID}>
      {w > 0 && <Animated.View style={[styles.segPill, SHADOW_SM, compact && { borderRadius: 10 }, pill]} />}
      {options.map((o) => (
        <Pressy
          key={o.value}
          style={styles.segItem}
          scaleTo={0.985}
          hapticKind="none"
          accessibilityRole="radio"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => {
            if (o.value !== value) haptic('light');
            onChange(o.value);
          }}
        >
          <T v="label" color={o.value === value ? INK : INK_SOFT} style={{ textAlign: 'center', fontSize, lineHeight: fontSize + 4 }} numberOfLines={1}>
            {o.label}
          </T>
          {o.sub ? (
            <T v="small" color={INK_SOFT} style={{ textAlign: 'center', fontSize: 11, marginTop: 1 }} numberOfLines={1}>
              {o.sub}
            </T>
          ) : null}
        </Pressy>
      ))}
    </View>
  );
}

/**
 * A number (or an ordinal choice, with `arrows`) between two round buttons.
 * The signs are drawn, not typed: the minus sign and the plus glyph have
 * different weights and optical sizes in Plus Jakarta Sans, so as text they
 * never looked like a pair.
 */
export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  format,
  arrows,
  a11y,
}: {
  value: number;
  onChange(v: number): void;
  step: number;
  min: number;
  max: number;
  format(v: number): string;
  /** ‹ › instead of − +, for a named scale rather than a number. */
  arrows?: boolean;
  a11y?: [string, string];
}) {
  const set = (v: number) => {
    const c = Math.min(max, Math.max(min, v));
    if (c !== value) haptic('light');
    onChange(c);
  };
  const [less, more] = a11y ?? (arrows ? ['Previous', 'Next'] : ['Less', 'More']);
  return (
    <View style={styles.stepper}>
      <Pressy style={[styles.stepBtn, SHADOW_SM, value <= min && styles.stepBtnOff]} onPress={() => set(value - step)} accessibilityLabel={less} hapticKind="none">
        {arrows ? <ChevronIcon size={22} dir="left" /> : <View style={styles.signBar} />}
      </Pressy>
      <T v="h2" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
        {format(value)}
      </T>
      <Pressy style={[styles.stepBtn, SHADOW_SM, value >= max && styles.stepBtnOff]} onPress={() => set(value + step)} accessibilityLabel={more} hapticKind="none">
        {arrows ? (
          <ChevronIcon size={22} dir="right" />
        ) : (
          <>
            <View style={styles.signBar} />
            <View style={[styles.signBar, styles.signBarUp]} />
          </>
        )}
      </Pressy>
    </View>
  );
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <View style={styles.toggleRow}>
      <T v="body" style={{ flex: 1 }}>
        {label}
      </T>
      <Switch
        value={value}
        onValueChange={(v) => {
          haptic('light');
          onChange(v);
        }}
        trackColor={{ false: INK_FAINT, true: INK }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={INK_FAINT}
      />
    </View>
  );
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={INK_SOFT} {...props} style={[styles.field, props.style]} />;
}

/**
 * The little uppercase label over a control. `aside` puts a second control
 * on the same line (the cm·kg / ft·lb switch), right-aligned and centred on
 * the label, so the two never need hand-tuned offsets.
 */
export function SectionTitle({ children, aside, style }: { children: React.ReactNode; aside?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  if (!aside) {
    return (
      <View style={[styles.sectionRow, style]}>
        <T v="small" color={INK_SOFT} style={styles.section}>
          {children}
        </T>
      </View>
    );
  }
  return (
    <View style={[styles.sectionRow, style]}>
      <T v="small" color={INK_SOFT} style={[styles.section, { flex: 1 }]}>
        {children}
      </T>
      {aside}
    </View>
  );
}

/**
 * The clay button: a soft vertical gradient with a light edge on top and a
 * shadow tinted in its own colour, so it reads as a shape with depth.
 */
export function Button({ label, onPress, kind = 'primary', disabled, testID }: { label: string; onPress(): void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; testID?: string }) {
  if (kind === 'ghost' || kind === 'danger') {
    return (
      <Pressy onPress={onPress} disabled={disabled} testID={testID} hapticKind="light" style={[styles.btn, kind === 'danger' && styles.btnDanger, disabled && { opacity: 0.45 }]}>
        <T v="button" color={kind === 'danger' ? '#C2334F' : INK_SOFT}>
          {label}
        </T>
      </Pressy>
    );
  }
  return (
    <Pressy onPress={onPress} disabled={disabled} testID={testID} hapticKind="medium" style={[styles.btn, styles.btnPrimary, disabled && { opacity: 0.45 }]}>
      <LinearGradient colors={['#FFB7C9', '#FF93AE']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.btnEdge} pointerEvents="none" />
      <T v="button">{label}</T>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', height: 48, borderRadius: 16, backgroundColor: INK_FAINT, alignItems: 'stretch' },
  segCompact: { height: 34, borderRadius: 12 },
  segPill: { position: 'absolute', top: 3, bottom: 3, borderRadius: 13, backgroundColor: SURFACE },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', height: 64, borderRadius: 20, backgroundColor: INK_FAINT, paddingHorizontal: 6 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  stepBtnOff: { opacity: 0.4 },
  signBar: { position: 'absolute', width: 17, height: 2.6, borderRadius: 2, backgroundColor: INK },
  signBarUp: { transform: [{ rotate: '90deg' }] },
  toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  field: { height: 52, borderRadius: 16, backgroundColor: INK_HAIR, paddingHorizontal: 16, fontFamily: FONT.body, fontSize: 16, color: INK },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22, marginBottom: 10 },
  section: { textTransform: 'uppercase', letterSpacing: 1.1, fontSize: 12 },
  btn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, overflow: 'hidden' },
  // the clay button glows in its own pink; it never casts a grey
  btnPrimary: shadowOf(BLUSH_DEEP, 'glow'),
  btnEdge: { ...ABS, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', borderBottomColor: 'rgba(255,255,255,0.1)' },
  btnDanger: { backgroundColor: 'rgba(194,51,79,0.07)' },
});
