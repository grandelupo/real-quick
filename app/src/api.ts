import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { sanitizeAnalysis, type Analysis } from './engine';
import { getState } from './store';
import { lang } from './i18n';

// The app's only network call. It talks to our own gateway, which holds the
// model key and the prompt (BACKEND.md → Model gateway) — no key ships here.

export const GATEWAY_URL: string =
  process.env.EXPO_PUBLIC_GATEWAY_URL ||
  (Constants.expoConfig?.extra as { gatewayUrl?: string } | undefined)?.gatewayUrl ||
  'https://realquick.lab.karolkrakowski.pl';

/** Wire codes — must equal the gateway's `error.code` values (server/test_gateway.py pins them). */
export type ApiErrorCode = 'daily_limit' | 'trial_over' | 'bad_request' | 'unauthorized' | 'upstream' | 'rate_limited' | 'network' | 'bad_coupon';

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message?: string) {
    super(message ?? code);
  }
}

const KNOWN: ApiErrorCode[] = ['daily_limit', 'trial_over', 'bad_request', 'unauthorized', 'upstream', 'rate_limited', 'bad_coupon'];

function tzOffset(): string {
  const m = -new Date().getTimezoneOffset();
  const sign = m >= 0 ? '+' : '-';
  const a = Math.abs(m);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

async function post(body: Record<string, unknown>): Promise<Analysis> {
  const s = getState();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}/v1/analyze`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Install-Id': s.installId,
        'X-Platform': Platform.OS,
        ...(s.isPro && s.proToken ? { 'X-Purchase-Token': s.proToken } : {}),
      },
      body: JSON.stringify({ ...body, lang, tz: tzOffset() }),
    });
  } catch {
    throw new ApiError('network');
  } finally {
    clearTimeout(timer);
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const code = (json as { error?: { code?: string } } | null)?.error?.code as ApiErrorCode | undefined;
    if (code && KNOWN.includes(code)) throw new ApiError(code);
    throw new ApiError(res.status === 402 ? 'daily_limit' : res.status >= 500 ? 'upstream' : 'bad_request');
  }
  return sanitizeAnalysis(json);
}

export function analyzePhoto(imageBase64: string): Promise<Analysis> {
  return post({ kind: 'photo', image: imageBase64 });
}

export function analyzeText(text: string): Promise<Analysis> {
  return post({ kind: 'text', text: text.slice(0, 500) });
}

// ---------------------------------------------------------------- sharing --

export interface SharePayload {
  name: string;
  unit: 'kcal' | 'kJ';
  days: Record<string, { kcal: number; goal: number; protein: number; carbs: number; fat: number; entries: { t: string; title: string; kcal: number }[] }>;
}

async function call(path: string, method: 'POST' | 'DELETE', body?: unknown): Promise<unknown> {
  const s = getState();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}${path}`, {
      method,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Install-Id': s.installId, 'X-Platform': Platform.OS },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network');
  } finally {
    clearTimeout(timer);
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) throw new ApiError(res.status >= 500 ? 'upstream' : 'bad_request');
  return json;
}

/** Create or refresh the live share; the token stays the same for this install. */
export async function putShare(payload: SharePayload): Promise<{ token: string; url: string }> {
  const r = (await call('/v1/share', 'POST', payload)) as { token?: string; url?: string } | null;
  if (!r?.token || !r.url) throw new ApiError('upstream');
  return { token: r.token, url: r.url };
}

export async function deleteShare(): Promise<void> {
  await call('/v1/share', 'DELETE');
}

// ---------------------------------------------------------------- coupons --

/** Redeems a coupon code for this install; resolves to the last day it covers. */
export async function redeemCoupon(code: string): Promise<string> {
  const s = getState();
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}/v1/coupon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Install-Id': s.installId, 'X-Platform': Platform.OS },
      body: JSON.stringify({ code: code.trim(), tz: tzOffset() }),
    });
  } catch {
    throw new ApiError('network');
  }
  type CouponReply = { until?: string; error?: { code?: string } };
  let json: CouponReply | null = null;
  try {
    json = (await res.json()) as CouponReply;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const c = json?.error?.code as ApiErrorCode | undefined;
    throw new ApiError(c && KNOWN.includes(c) ? c : res.status >= 500 ? 'upstream' : 'bad_request');
  }
  if (!json?.until) throw new ApiError('upstream');
  return json.until;
}
