jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'ja' }] }), { virtual: true });

import { __dicts, t } from '../i18n';

function keys(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

test('every English string has a Japanese translation', () => {
  const en = keys(__dicts.en);
  const ja = new Set(keys(__dicts.ja));
  expect(en.filter((k) => !ja.has(k))).toEqual([]);
});

test('placeholders survive translation', () => {
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  const en = __dicts.en as unknown as Record<string, unknown>;
  const ja = __dicts.ja as unknown as Record<string, unknown>;
  for (const k of Object.keys(en)) {
    if (typeof en[k] === 'string' && typeof ja[k] === 'string') expect([k, ph(ja[k] as string)]).toEqual([k, ph(en[k] as string)]);
  }
});

test('interpolation', () => {
  expect(t('left', { n: '890' })).toBe('あと 890');
  expect(t('pending', { n: 2 })).toBe('2件 計算中…');
});
