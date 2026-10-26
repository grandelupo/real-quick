import React, { useState } from 'react';
import { StyleSheet, Switch, TextInput, View, type LayoutChangeEvent, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ABS, BLUSH_DEEP, FONT, INK, INK_FAINT, INK_HAIR, INK_SOFT, SHADOW_SM, SURFACE } from '../theme';
import { TIMING } from './motion';
import { Pressy, T, haptic } from './kit';

// Branded controls: a segmented picker with a sliding white pill, a stepper,
// a toggle row, a text field and the clay button — enough for every setting.

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
    transform: [{ translateX: withTiming(idx * segW + 3, TIMING) }],
  }));
  const tall = options.some((o) => o.sub);
  return (
    <View style={[styles.seg, tall && { height: 62 }]} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} testID={testID}>
      {w > 0 && <Animated.View style={[styles.segPill, SHADOW_SM, pill]} />}
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
          <T v="label" color={o.value === value ? INK : INK_SOFT} style={{ textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
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

export function Stepper({ value, onChange, step, min, max, format }: { value: number; onChange(v: number): void; step: number; min: number; max: number; format(v: number): string }) {
  const set = (v: number) => {
    const c = Math.min(max, Math.max(min, v));
    if (c !== value) haptic('light');
    onChange(c);
  };
  return (
    <View style={styles.stepper}>
      <Pressy style={[styles.stepBtn, SHADOW_SM]} onPress={() => set(value - step)} accessibilityLabel="−" hapticKind="none">
        <T v="title" style={{ lineHeight: 30 }}>−</T>
      </Pressy>
      <T v="h2" style={{ flex: 1, textAlign: 'center' }}>
        {format(value)}
      </T>
      <Pressy style={[styles.stepBtn, SHADOW_SM]} onPress={() => set(value + step)} accessibilityLabel="+" hapticKind="none">
        <T v="title" style={{ lineHeight: 30 }}>+</T>
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

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <T v="small" color={INK_SOFT} style={styles.section}>
      {children}
    </T>
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
  segPill: { position: 'absolute', top: 3, bottom: 3, borderRadius: 13, backgroundColor: SURFACE },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', height: 64, borderRadius: 20, backgroundColor: INK_FAINT, paddingHorizontal: 6 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  field: { height: 52, borderRadius: 16, backgroundColor: INK_HAIR, paddingHorizontal: 16, fontFamily: FONT.body, fontSize: 16, color: INK },
  section: { textTransform: 'uppercase', letterSpacing: 1.1, fontSize: 12, marginTop: 24, marginBottom: 10 },
  btn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, overflow: 'hidden' },
  btnPrimary: {
    shadowColor: BLUSH_DEEP,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  btnEdge: { ...ABS, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', borderBottomColor: 'rgba(255,255,255,0.1)' },
  btnDanger: { backgroundColor: 'rgba(194,51,79,0.07)' },
});
