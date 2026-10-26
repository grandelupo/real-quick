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
export type ApiErrorCode = 'daily_limit' | 'bad_request' | 'unauthorized' | 'upstream' | 'rate_limited' | 'network';

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message?: string) {
    super(message ?? code);
  }
}

const KNOWN: ApiErrorCode[] = ['daily_limit', 'bad_request', 'unauthorized', 'upstream', 'rate_limited'];

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
