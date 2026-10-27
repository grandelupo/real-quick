// Calendar maths on local days. Every day is a `YYYY-MM-DD` key in the
// device's time zone, so an entry snapped at 23:58 stays on that evening.

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Noon on the day — immune to DST shifts when adding days. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(key: string, n: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const ms = parseDayKey(b).getTime() - parseDayKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Pages for the vertical day pager, newest first: today at index 0, then
 * yesterday, … back to `earliest` — but always at least `minDays` pages so a
 * new user can already feel the scroll.
 */
export function dayPages(today: string, earliest: string | undefined, minDays = 7, maxDays = 366): string[] {
  const span = earliest ? daysBetween(earliest, today) + 1 : 1;
  const count = Math.min(maxDays, Math.max(minDays, span));
  return Array.from({ length: count }, (_, i) => addDays(today, -i));
}

/** 0 = Monday … 6 = Sunday. Each weekday owns one pastel palette. */
export function weekdayIndex(key: string): number {
  return (parseDayKey(key).getDay() + 6) % 7;
}

export const NIGHT_START_HOUR = 20;
export const NIGHT_END_HOUR = 6;

/** The app's night look runs 20:00–05:59 local time. */
export function isNight(d: Date): boolean {
  const h = d.getHours();
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

/** Milliseconds until the look should next flip between day and night. */
export function msUntilLookChange(d: Date): number {
  const next = new Date(d);
  next.setMinutes(0, 0, 0);
  const h = d.getHours();
  if (isNight(d)) {
    if (h >= NIGHT_START_HOUR) next.setDate(next.getDate() + 1);
    next.setHours(NIGHT_END_HOUR);
  } else {
    next.setHours(NIGHT_START_HOUR);
  }
  return Math.max(1000, next.getTime() - d.getTime());
}

/** Free snaps per local day; Pro is unlimited (the gateway enforces both). */
export const FREE_AI_PER_DAY = 3;

/** The free window: this many local days from the first launch, then Pro. */
export const TRIAL_DAYS = 3;

/** Free days left including today: TRIAL_DAYS on the first day, 0 once it is over. */
export function freeDaysLeft(firstDay: string | undefined, today: string): number {
  if (!firstDay) return TRIAL_DAYS;
  const a = Date.UTC(Number(firstDay.slice(0, 4)), Number(firstDay.slice(5, 7)) - 1, Number(firstDay.slice(8, 10)));
  const b = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  const index = Math.floor((b - a) / 86_400_000);
  return Math.max(0, TRIAL_DAYS - Math.max(0, index));
}
