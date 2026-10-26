import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import { DayArt } from '../art/DayArt';
import { Hero } from '../art/Hero';
import { BIAS_MULTIPLIER, GOAL_MAX, GOAL_MIN, GOAL_STEP, dayKey, toUnit, weekdayIndex, type Bias, type Profile } from '../engine';
import { n, t } from '../i18n';
import { setSettings, useStore } from '../store';
import { DAYS, INK, INK_FAINT, INK_HAIR, INK_SOFT, MACRO, PAPER, SHADOW, SHADOW_SM, SURFACE } from '../theme';
import { CameraIcon, ChevronIcon, NotesIcon } from '../ui/Icons';
import { EASE_OUT, TIMING } from '../ui/motion';
import { Pressy, T } from '../ui/kit';
import { Button, Segmented, Stepper } from '../ui/controls';
import { GoalCalculator } from '../components/GoalCalculator';

// Deliberately short: the app has one job, so onboarding asks for the real
// settings it needs (goal, estimate style, camera) and teaches the three
// gestures. It is the settings sheet with a friendly face, not a quiz funnel.

type Step = 'hello' | 'goal' | 'bias' | 'camera' | 'tour';
const STEPS: Step[] = ['hello', 'goal', 'bias', 'camera', 'tour'];

export function Onboarding({ onDone }: { onDone(): void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const settings = useStore((s) => s.settings);
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<'know' | 'calc'>('know');
  const [calc, setCalc] = useState<{ goal: number; profile: Profile } | null>(null);
  const [, requestPerm] = useCameraPermissions();
  const step = STEPS[i];
  const wd = weekdayIndex(dayKey(new Date()));

  const next = () => {
    if (step === 'goal' && mode === 'calc' && calc) setSettings({ goalKcal: calc.goal, profile: calc.profile });
    if (i < STEPS.length - 1) setI(i + 1);
    else onDone();
  };
  const back = () => setI(Math.max(0, i - 1));

  const progress = useAnimatedStyle(() => ({ width: withTiming(`${((i + 1) / STEPS.length) * 100}%`, TIMING) }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <DayArt weekday={wd} width={width} height={height} night={false} />
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Pressy onPress={back} disabled={i === 0} style={[styles.back, SHADOW_SM, i === 0 && { opacity: 0 }]} accessibilityLabel="Back">
          <ChevronIcon size={22} />
        </Pressy>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progress]} />
        </View>
        <View style={{ width: 44 }} />
      </View>

      <Animated.View key={step} entering={FadeIn.duration(320).easing(EASE_OUT)} exiting={FadeOut.duration(140)} style={[styles.card, SHADOW, { marginBottom: insets.bottom + 16 }]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {(step === 'hello' || step === 'camera') && (
            <View style={{ alignItems: 'center', marginBottom: 6 }}>
              <Hero kind={step === 'hello' ? DAYS[wd].hero : 'camera'} size={step === 'hello' ? 168 : 128} />
            </View>
          )}

          {step === 'hello' && (
            <>
              <T v="title" style={styles.h}>
                {t('obHelloTitle')}
              </T>
              <T v="body" color={INK_SOFT} style={styles.p}>
                {t('obHelloBody')}
              </T>
            </>
          )}

          {step === 'goal' && (
            <>
              <T v="title" style={styles.h}>
                {t('obGoalTitle')}
              </T>
              <T v="body" color={INK_SOFT} style={styles.p}>
                {t('obGoalBody')}
              </T>
              <Segmented<'know' | 'calc'>
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'know', label: t('iKnow') },
                  { value: 'calc', label: t('workItOut') },
                ]}
              />
              <View style={{ height: 14 }} />
              {mode === 'know' ? (
                <Stepper
                  value={settings.goalKcal}
                  step={GOAL_STEP}
                  min={GOAL_MIN}
                  max={GOAL_MAX}
                  onChange={(goalKcal) => setSettings({ goalKcal })}
                  format={(v) => `${n(toUnit(v, settings.unit))} ${settings.unit}`}
                />
              ) : (
                <GoalCalculator
                  initial={settings.profile}
                  imperial={settings.imperial}
                  unit={settings.unit}
                  onImperial={(imperial) => setSettings({ imperial })}
                  onChange={(goal, profile) => setCalc({ goal, profile })}
                />
              )}
            </>
          )}

          {step === 'bias' && (
            <>
              <T v="title" style={styles.h}>
                {t('obBiasTitle')}
              </T>
              <T v="body" color={INK_SOFT} style={styles.p}>
                {t('obBiasBody')}
              </T>
              {(
                [
                  ['under', t('biasUnder'), t('biasUnderSub')],
                  ['honest', t('biasHonest'), t('biasHonestSub')],
                  ['over', t('biasOver'), t('biasOverSub')],
                ] as [Bias, string, string][]
              ).map(([b, label, sub]) => {
                const on = settings.bias === b;
                return (
                  <Pressy
                    key={b}
                    onPress={() => setSettings({ bias: b })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={[styles.option, on && [styles.optionOn, SHADOW_SM]]}
                    scaleTo={0.985}
                  >
                    <View style={{ flex: 1 }}>
                      <T v="h2">{label}</T>
                      <T v="small" color={INK_SOFT}>
                        {sub}
                      </T>
                    </View>
                    <T v="h2" color={on ? INK : INK_SOFT}>
                      {Math.round(600 * BIAS_MULTIPLIER[b])}
                    </T>
                  </Pressy>
                );
              })}
            </>
          )}

          {step === 'camera' && (
            <>
              <T v="title" style={styles.h}>
                {t('obCameraTitle')}
              </T>
              <T v="body" color={INK_SOFT} style={styles.p}>
                {t('obCameraBody')}
              </T>
            </>
          )}

          {step === 'tour' && (
            <>
              <T v="title" style={styles.h}>
                {t('obTourTitle')}
              </T>
              {[
                [<CameraIcon key="c" size={22} />, t('obTour1'), MACRO.protein],
                [<NotesIcon key="n" size={22} />, t('obTour2'), MACRO.carbs],
                [<ChevronIcon key="u" size={22} dir="up" />, t('obTour3'), MACRO.fat],
              ].map(([icon, text, color], k) => (
                <View key={k} style={styles.tourRow}>
                  <View style={[styles.tourIcon, { backgroundColor: `${color as string}33` }]}>{icon}</View>
                  <T v="body" style={{ flex: 1 }}>
                    {text as string}
                  </T>
                </View>
              ))}
              <View style={styles.tip}>
                <T v="small" color={INK_SOFT}>{Platform.OS === 'android' ? t('obWidgetAndroid') : t('obWidget')}</T>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step === 'camera' ? (
            <>
              <Button
                label={t('obCameraCta')}
                testID="onboarding-continue"
                onPress={async () => {
                  await requestPerm().catch(() => undefined);
                  next();
                }}
              />
              <Button label={t('notNow')} kind="ghost" onPress={next} />
            </>
          ) : (
            <Button label={step === 'tour' ? t('letsGo') : t('continue')} onPress={next} testID="onboarding-continue" />
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.7)', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: INK },
  card: { flex: 1, marginTop: 18, marginHorizontal: 14, borderRadius: 34, backgroundColor: PAPER, overflow: 'hidden' },
  scroll: { padding: 24, paddingBottom: 8, flexGrow: 1, justifyContent: 'center' },
  h: { textAlign: 'center', marginTop: 8 },
  p: { textAlign: 'center', marginTop: 8, marginBottom: 20 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: INK_HAIR, marginBottom: 10 },
  optionOn: { backgroundColor: SURFACE },
  tourRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  tourIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tip: { marginTop: 22, padding: 14, borderRadius: 18, backgroundColor: INK_FAINT },
  footer: { padding: 16, paddingTop: 8, gap: 4 },
});
