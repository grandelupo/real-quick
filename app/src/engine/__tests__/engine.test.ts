import { freeDaysLeft, TRIAL_DAYS,
  BIAS_MULTIPLIER,
  addDays,
  bmr,
  clampGoal,
  dayKey,
  dayMood,
  dayPages,
  dayTotals,
  daysBetween,
  entryMacros,
  isNight,
  macroTargets,
  msUntilLookChange,
  parseLocally,
  parsePart,
  sanitizeAnalysis,
  splitParts,
  suggestedGoal,
  toUnit,
  weekdayIndex,
  type Entry,
} from '..';

const item = (kcal: number, p = 10, c = 10, f = 10) => ({ name: 'x', emoji: '🍎', grams: 100, kcal, protein: p, carbs: c, fat: f });

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: '1',
  createdAt: 0,
  dayKey: '2026-10-26',
  source: 'photo',
  status: 'ready',
  items: [item(300), item(200)],
  multiplier: 1,
  scale: 1,
  attempts: 1,
  ...over,
});

describe('nutrition', () => {
  test('entry totals sum items and apply bias and portion scale', () => {
    expect(entryMacros(entry()).kcal).toBe(500);
    expect(entryMacros(entry({ multiplier: BIAS_MULTIPLIER.over })).kcal).toBeCloseTo(575);
    expect(entryMacros(entry({ scale: 0.5 })).kcal).toBe(250);
  });

  test('pending, failed and limit entries count as zero', () => {
    for (const status of ['pending', 'failed', 'limit'] as const) {
      expect(entryMacros(entry({ status })).kcal).toBe(0);
    }
  });

  test('day totals', () => {
    const t = dayTotals([entry(), entry({ items: [item(100, 5, 6, 7)] })]);
    expect(t.kcal).toBe(600);
    expect(t.protein).toBe(25);
  });

  test('bias leans further over than under', () => {
    expect(BIAS_MULTIPLIER.over - 1).toBeGreaterThan(1 - BIAS_MULTIPLIER.under);
    expect(BIAS_MULTIPLIER.honest).toBe(1);
  });

  test('macro targets add back up to the goal', () => {
    const m = macroTargets(2000);
    const kcal = m.protein * 4 + m.carbs * 4 + m.fat * 9;
    expect(Math.abs(kcal - 2000)).toBeLessThan(15);
  });

  test('Mifflin–St Jeor reference values', () => {
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780);
    expect(bmr({ sex: 'female', age: 30, heightCm: 165, weightKg: 60 })).toBeCloseTo(1320.25);
  });

  test('suggested goal is stepped, clamped and never below the safe floor', () => {
    const g = suggestedGoal({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'maintain' });
    expect(g % 50).toBe(0);
    expect(g).toBe(2750);
    const tiny = suggestedGoal({ sex: 'female', age: 70, heightCm: 145, weightKg: 40, activity: 'low', goal: 'lose' });
    expect(tiny).toBeGreaterThanOrEqual(1200);
    expect(clampGoal(99999)).toBe(5000);
    expect(clampGoal(10)).toBe(1000);
  });

  test('unit conversion', () => {
    expect(toUnit(100, 'kcal')).toBe(100);
    expect(toUnit(100, 'kJ')).toBe(418);
  });

  test('day mood covers every band', () => {
    expect(dayMood(0, 2000)).toBe('empty');
    expect(dayMood(500, 2000)).toBe('started');
    expect(dayMood(1500, 2000)).toBe('onTrack');
    expect(dayMood(2000, 2000)).toBe('nailed');
    expect(dayMood(2500, 2000)).toBe('over');
  });
});

describe('days', () => {
  test('keys are local and survive DST', () => {
    expect(dayKey(new Date(2026, 9, 26, 23, 58))).toBe('2026-10-26');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-01', '2026-10-26')).toBe(25);
  });

  test('pages are newest first with a minimum length', () => {
    const p = dayPages('2026-10-26', undefined);
    expect(p).toHaveLength(7);
    expect(p[0]).toBe('2026-10-26');
    expect(p[1]).toBe('2026-10-25');
    expect(dayPages('2026-10-26', '2026-09-26')).toHaveLength(31);
    expect(dayPages('2026-10-26', '2000-01-01')).toHaveLength(366);
  });

  test('weekday index is Monday-based', () => {
    expect(weekdayIndex('2026-10-26')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-01')).toBe(6); // Sunday
  });

  test('night window', () => {
    expect(isNight(new Date(2026, 9, 26, 21))).toBe(true);
    expect(isNight(new Date(2026, 9, 26, 3))).toBe(true);
    expect(isNight(new Date(2026, 9, 26, 6))).toBe(false);
    expect(isNight(new Date(2026, 9, 26, 19, 59))).toBe(false);
  });

  test('look change timer lands on the boundary', () => {
    const at = new Date(2026, 9, 26, 19, 0);
    expect(msUntilLookChange(at)).toBe(60 * 60 * 1000);
    const late = new Date(2026, 9, 26, 22, 0);
    expect(msUntilLookChange(late)).toBe(8 * 60 * 60 * 1000);
  });
});

describe('local foods', () => {
  test('split', () => {
    expect(splitParts('2 eggs, toast and a coffee')).toEqual(['2 eggs', 'toast', 'a coffee']);
    expect(splitParts('ご飯、味噌汁')).toEqual(['ご飯', '味噌汁']);
  });

  test('quantities', () => {
    expect(parsePart('2 eggs')).toEqual({ qty: 2, grams: undefined, name: 'eggs' });
    expect(parsePart('half avocado').qty).toBe(0.5);
    expect(parsePart('150g chicken breast')).toEqual({ qty: 1, grams: 150, name: 'chicken breast' });
    expect(parsePart('卵2個')).toEqual({ qty: 2, grams: undefined, name: '卵' });
  });

  test('fully known text resolves locally', () => {
    const items = parseLocally('2 eggs and toast')!;
    expect(items).toHaveLength(2);
    expect(items[0].kcal).toBe(144);
    expect(items[0].name).toBe('2 × Egg');
    expect(parseLocally('Banana')![0].emoji).toBe('🍌');
    expect(parseLocally('300g rice')![0].grams).toBe(300);
  });

  test('anything unknown defers the whole sentence to the AI', () => {
    expect(parseLocally('2 eggs and a grandma special casserole')).toBeNull();
    expect(parseLocally('')).toBeNull();
    expect(parseLocally('500 bananas')).toBeNull();
  });
});

describe('validate', () => {
  test('cleans hostile model output', () => {
    const a = sanitizeAnalysis({
      title: '  Lunch  ',
      items: [
        { name: 'Rice', emoji: '🍚', grams: -5, kcal: '250', protein: 4, carbs: 56, fat: 0.5 },
        { name: '', kcal: 100 },
        { name: 'Mystery', emoji: 'abc', protein: 10, carbs: 10, fat: 10 },
        'nonsense',
      ],
    });
    expect(a.title).toBe('Lunch');
    expect(a.items).toHaveLength(2);
    expect(a.items[0].grams).toBe(0);
    expect(a.items[0].kcal).toBe(250);
    expect(a.items[1].emoji).toBe('🍽️');
    expect(a.items[1].kcal).toBe(170);
  });

  test('no food', () => {
    expect(sanitizeAnalysis({ items: [] }).noFood).toBe(true);
    expect(sanitizeAnalysis(null).noFood).toBe(true);
  });

  test('caps item count', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `i${i}`, kcal: 1 }));
    expect(sanitizeAnalysis({ items: many }).items).toHaveLength(12);
  });
});

describe('free days', () => {
  it('counts down from the first day and closes', () => {
    expect(freeDaysLeft(undefined, '2026-10-26')).toBe(TRIAL_DAYS);
    expect(freeDaysLeft('2026-10-26', '2026-10-26')).toBe(3);
    expect(freeDaysLeft('2026-10-26', '2026-10-28')).toBe(1);
    expect(freeDaysLeft('2026-10-26', '2026-10-29')).toBe(0);
    expect(freeDaysLeft('2026-10-26', '2026-12-01')).toBe(0);
    expect(freeDaysLeft('2026-10-30', '2026-10-26')).toBe(3); // clock went backwards: stay generous
  });
});
