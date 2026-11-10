import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { cmToIn, inToCm, kgToLb, lbToKg, suggestedGoal, toUnit, type Activity, type GoalKind, type Profile, type Sex } from '../engine';
import { n, t } from '../i18n';
import { INK_SOFT } from '../theme';
import { T } from '../ui/kit';
import { SectionTitle, Segmented, Stepper } from '../ui/controls';
import { useCountUp } from './DayPage';

// Mifflin–St Jeor with an activity factor and a gentle goal delta — the
// engine does the maths (engine/nutrition.ts), this is just the form.

/** Sedentary → very active; the stepper walks this order. */
const ACTIVITIES: Activity[] = ['low', 'light', 'moderate', 'high'];
const ACTIVITY_KEYS = ['actLow', 'actLight', 'actModerate', 'actHigh'] as const;

export const DEFAULT_PROFILE: Profile = { sex: 'female', age: 32, heightCm: 168, weightKg: 68, activity: 'light', goal: 'maintain' };

export function GoalCalculator({
  initial,
  imperial,
  unit,
  onImperial,
  onChange,
}: {
  initial?: Profile;
  imperial: boolean;
  unit: 'kcal' | 'kJ';
  onImperial(v: boolean): void;
  onChange(goal: number, profile: Profile): void;
}) {
  const [p, setP] = useState<Profile>(initial ?? DEFAULT_PROFILE);
  const goal = useMemo(() => suggestedGoal(p), [p]);
  const shown = useCountUp(toUnit(goal, unit), 400);

  const update = (patch: Partial<Profile>) => {
    const next = { ...p, ...patch };
    setP(next);
    onChange(suggestedGoal(next), next);
  };

  React.useEffect(() => {
    onChange(goal, p);
    // Report the starting suggestion once so "Continue" always has a value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <View style={styles.result}>
        <T v="hero" style={{ fontSize: 52, lineHeight: 58 }}>
          {n(shown)}
        </T>
        <T v="label" color={INK_SOFT}>
          {t('perDay', { unit })}
        </T>
      </View>
      <SectionTitle>{t('goalKind')}</SectionTitle>
      <Segmented<GoalKind>
        value={p.goal}
        onChange={(goal) => update({ goal })}
        options={[
          { value: 'lose', label: t('goalLose') },
          { value: 'maintain', label: t('goalMaintain') },
          { value: 'gain', label: t('goalGain') },
        ]}
      />
      <SectionTitle>{`${t('sexF')} / ${t('sexM')}`}</SectionTitle>
      <Segmented<Sex>
        value={p.sex}
        onChange={(sex) => update({ sex })}
        options={[
          { value: 'female', label: t('sexF') },
          { value: 'male', label: t('sexM') },
        ]}
      />
      <SectionTitle>{t('age')}</SectionTitle>
      <Stepper value={p.age} step={1} min={14} max={99} onChange={(age) => update({ age })} format={(v) => String(v)} />
      <SectionTitle
        aside={
          <View style={styles.units}>
            <Segmented
              value={imperial ? 'imp' : 'met'}
              onChange={(v) => onImperial(v === 'imp')}
              options={[
                { value: 'met', label: 'cm · kg' },
                { value: 'imp', label: 'ft · lb' },
              ]}
              compact
            />
          </View>
        }
      >
        {t('height')}
      </SectionTitle>
      <Stepper
        value={imperial ? Math.round(cmToIn(p.heightCm)) : Math.round(p.heightCm)}
        step={1}
        min={imperial ? 48 : 120}
        max={imperial ? 90 : 230}
        onChange={(v) => update({ heightCm: imperial ? inToCm(v) : v })}
        format={(v) => (imperial ? `${Math.floor(v / 12)}′ ${v % 12}″` : `${v} cm`)}
      />
      <SectionTitle>{t('weight')}</SectionTitle>
      <Stepper
        value={imperial ? Math.round(kgToLb(p.weightKg)) : Math.round(p.weightKg)}
        step={1}
        min={imperial ? 66 : 30}
        max={imperial ? 660 : 300}
        onChange={(v) => update({ weightKg: imperial ? lbToKg(v) : v })}
        format={(v) => (imperial ? `${v} lb` : `${v} kg`)}
      />
      <SectionTitle>{t('activity')}</SectionTitle>
      {/* Four sentence-length labels never fit a four-up segmented control —
          they came out at 11pt with "On my feet a bit" elided. Activity is an
          ordinal scale anyway, so it reads like the steppers above it. */}
      <Stepper
        value={Math.max(0, ACTIVITIES.indexOf(p.activity))}
        step={1}
        min={0}
        max={ACTIVITIES.length - 1}
        onChange={(i) => update({ activity: ACTIVITIES[i] })}
        format={(i) => t(ACTIVITY_KEYS[i])}
        arrows
      />
    </View>
  );
}

const styles = StyleSheet.create({
  result: { alignItems: 'center', gap: 2, paddingTop: 4, paddingBottom: 2 },
  units: { width: 164 },
});
