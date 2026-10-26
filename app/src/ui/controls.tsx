import React, { useState } from 'react';
import { StyleSheet, Switch, TextInput, View, type LayoutChangeEvent, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { BLUSH, FONT, INK, INK_FAINT, INK_SOFT } from '../theme';
import { Pressy, T, haptic } from './kit';

// Branded controls: a segmented picker with a sliding blush pill, a stepper,
// a toggle row and a text field — enough for every setting in the app.

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: V; label: string; sub?: string }[];
  value: V;
  onChange(v: V): void;
  testID?: string;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = options.length ? w / options.length : 0;
  const pill = useAnimatedStyle(() => ({
    width: segW - 6,
    transform: [{ translateX: withSpring(idx * segW + 3, { damping: 18, stiffness: 260 }) }],
  }));
  const tall = options.some((o) => o.sub);
  return (
    <View style={[styles.seg, tall && { height: 64 }]} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} testID={testID}>
      {w > 0 && <Animated.View style={[styles.segPill, pill]} />}
      {options.map((o) => (
        <Pressy
          key={o.value}
          style={styles.segItem}
          scaleTo={0.96}
          hapticKind="none"
          accessibilityRole="radio"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => {
            if (o.value !== value) haptic('light');
            onChange(o.value);
          }}
        >
          <T v="label" style={{ textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {o.label}
          </T>
          {o.sub ? (
            <T v="small" color={INK_SOFT} style={{ textAlign: 'center', fontSize: 11 }} numberOfLines={1}>
              {o.sub}
            </T>
          ) : null}
        </Pressy>
      ))}
    </View>
  );
}

export function Stepper({ value, onChange, step, min, max, format }: { value: number; onChange(v: number): void; step: number; min: number; max: number; format(v: number): string }) {
  const set = (v: number) => {
    const c = Math.min(max, Math.max(min, v));
    if (c !== value) haptic('light');
    onChange(c);
  };
  return (
    <View style={styles.stepper}>
      <Pressy style={styles.stepBtn} onPress={() => set(value - step)} accessibilityLabel="−" hapticKind="none">
        <T v="title">−</T>
      </Pressy>
      <T v="title" style={{ flex: 1, textAlign: 'center' }}>
        {format(value)}
      </T>
      <Pressy style={styles.stepBtn} onPress={() => set(value + step)} accessibilityLabel="+" hapticKind="none">
        <T v="title">+</T>
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
        trackColor={{ false: INK_FAINT, true: BLUSH }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={INK_FAINT}
      />
    </View>
  );
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={INK_SOFT} {...props} style={[styles.field, props.style]} />;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <T v="label" color={INK_SOFT} style={styles.section}>
      {children}
    </T>
  );
}

export function Button({ label, onPress, kind = 'primary', disabled, testID }: { label: string; onPress(): void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; testID?: string }) {
  return (
    <Pressy
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      hapticKind={kind === 'primary' ? 'medium' : 'light'}
      style={[styles.btn, kind === 'primary' && styles.btnPrimary, kind === 'ghost' && styles.btnGhost, kind === 'danger' && styles.btnDanger, disabled && { opacity: 0.45 }]}
    >
      <T v="button" color={kind === 'danger' ? '#C2334F' : INK}>
        {label}
      </T>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', height: 48, borderRadius: 18, backgroundColor: INK_FAINT, alignItems: 'stretch' },
  segPill: { position: 'absolute', top: 3, bottom: 3, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: INK },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', height: 64, borderRadius: 20, backgroundColor: INK_FAINT, paddingHorizontal: 6 },
  stepBtn: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  field: { height: 52, borderRadius: 16, borderWidth: 2.5, borderColor: INK, backgroundColor: '#FFFFFF', paddingHorizontal: 16, fontFamily: FONT.body, fontSize: 16, color: INK },
  section: { textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 22, marginBottom: 10 },
  btn: { height: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnPrimary: { backgroundColor: BLUSH, borderWidth: 2.5, borderColor: INK },
  btnGhost: { backgroundColor: 'transparent' },
  btnDanger: { backgroundColor: 'rgba(194,51,79,0.08)' },
});
