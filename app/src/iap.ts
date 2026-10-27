import { Linking, Platform } from 'react-native';
import * as IAP from 'expo-iap';
import type { Product, ProductSubscription, Purchase } from 'expo-iap';
import { dayKey } from './engine';
import { getState, setState } from './store';

// StoreKit 2 / Play Billing through expo-iap. One subscription group "Pro",
// two products. Prices and trial copy are always read from the store; the
// mock set below mirrors RealQuick.storekit + the Play console for the
// review screenshot and the web build only.

export const SKU = {
  monthly: 'com.latovi.realquick.pro.monthly',
  yearly: 'com.latovi.realquick.pro.yearly',
} as const;

export interface Plan {
  id: string;
  period: 'month' | 'year';
  price: number;
  displayPrice: string;
  currency: string;
  /** Free-trial length, when the store says this user is eligible. */
  trial?: { value: number; unit: 'day' | 'week' | 'month' };
  offerToken?: string;
}

export const MOCK_PLANS: Plan[] = [
  { id: SKU.yearly, period: 'year', price: 29.99, displayPrice: '$29.99', currency: 'USD', trial: { value: 1, unit: 'week' } },
  { id: SKU.monthly, period: 'month', price: 4.99, displayPrice: '$4.99', currency: 'USD', trial: { value: 1, unit: 'week' } },
];

export const useMockProducts = Platform.OS === 'web' || process.env.EXPO_PUBLIC_MOCK_PRODUCTS === '1';

let connected = false;

function toPlan(p: Product | ProductSubscription): Plan | null {
  if (p.id !== SKU.monthly && p.id !== SKU.yearly) return null;
  const period = p.id === SKU.yearly ? 'year' : 'month';
  const offers = (p as ProductSubscription).subscriptionOffers ?? [];
  const trialOffer = offers.find((o) => o.paymentMode === 'free-trial' || (o.type === 'introductory' && o.price === 0));
  let trial: Plan['trial'];
  if (trialOffer?.period && trialOffer.period.unit !== 'unknown' && trialOffer.period.unit !== 'year') {
    trial = { value: trialOffer.period.value * (trialOffer.periodCount ?? 1), unit: trialOffer.period.unit };
  }
  // Android: the base plan's own offer token (the trial offer when eligible).
  const androidOffer = trialOffer?.offerTokenAndroid ?? offers.find((o) => o.offerTokenAndroid)?.offerTokenAndroid ?? undefined;
  return {
    id: p.id,
    period,
    price: typeof p.price === 'number' ? p.price : Number(p.price ?? 0),
    displayPrice: p.displayPrice,
    currency: p.currency,
    trial,
    offerToken: androidOffer ?? undefined,
  };
}

async function onPurchase(purchase: Purchase) {
  if (purchase.productId !== SKU.monthly && purchase.productId !== SKU.yearly) return;
  setState({ isPro: true, proToken: purchase.purchaseToken ?? undefined });
  try {
    await IAP.finishTransaction({ purchase, isConsumable: false });
  } catch {
    // replays next launch; entitlement is already applied
  }
}

/** Pro granted by a coupon code, while its last day has not passed. */
export function couponActive(): boolean {
  const until = getState().proUntil;
  return !!until && until >= dayKey(new Date());
}

let purchaseWaiter: ((ok: boolean) => void) | null = null;

export async function initIap() {
  if (useMockProducts || connected) return;
  try {
    await IAP.initConnection();
    connected = true;
    IAP.purchaseUpdatedListener((p) => {
      void onPurchase(p).then(() => {
        purchaseWaiter?.(true);
        purchaseWaiter = null;
      });
    });
    IAP.purchaseErrorListener(() => {
      purchaseWaiter?.(false);
      purchaseWaiter = null;
    });
    await refreshEntitlement();
  } catch {
    connected = false;
  }
}

/** Re-checks the store so a lapsed subscription stops counting as Pro. */
export async function refreshEntitlement() {
  if (useMockProducts || !connected) return;
  try {
    const subs = await IAP.getActiveSubscriptions([SKU.monthly, SKU.yearly]);
    const active = subs.find((s) => s.productId === SKU.monthly || s.productId === SKU.yearly);
    if (active) setState({ isPro: true, proToken: active.purchaseToken ?? getState().proToken });
    else if (couponActive()) setState({ isPro: true, proToken: undefined });
    else if (getState().isPro) setState({ isPro: false, proToken: undefined });
  } catch {
    // offline: keep whatever we knew
  }
}

export async function loadPlans(): Promise<Plan[]> {
  if (useMockProducts) return MOCK_PLANS;
  await initIap();
  if (!connected) return [];
  try {
    const products = (await IAP.fetchProducts({ skus: [SKU.yearly, SKU.monthly], type: 'subs' })) ?? [];
    const plans = (products as (Product | ProductSubscription)[]).map(toPlan).filter((p): p is Plan => p !== null);
    return plans.sort((a, b) => (a.period === b.period ? 0 : a.period === 'year' ? -1 : 1));
  } catch {
    return [];
  }
}

export async function buy(plan: Plan): Promise<boolean> {
  if (useMockProducts) return false;
  const done = new Promise<boolean>((resolve) => {
    purchaseWaiter = resolve;
  });
  try {
    await IAP.requestPurchase({
      type: 'subs',
      request: {
        apple: { sku: plan.id },
        google: { skus: [plan.id], subscriptionOffers: plan.offerToken ? [{ sku: plan.id, offerToken: plan.offerToken }] : undefined },
      },
    } as Parameters<typeof IAP.requestPurchase>[0]);
  } catch {
    purchaseWaiter = null;
    return false;
  }
  return done;
}

export async function restore(): Promise<boolean> {
  if (useMockProducts) return false;
  await initIap();
  try {
    await IAP.restorePurchases();
  } catch {
    // fall through to the entitlement check
  }
  await refreshEntitlement();
  return getState().isPro;
}

export async function manageSubscriptions() {
  try {
    await IAP.deepLinkToSubscriptions({ skuAndroid: SKU.yearly, packageNameAndroid: 'com.latovi.realquick' });
  } catch {
    void Linking.openURL(Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions');
  }
}

/** "$0.08" — the yearly price per day, currency-formatted from the live product. */
export function perDay(plan: Plan, locale?: string): string {
  const v = plan.price / (plan.period === 'year' ? 365 : 30);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: plan.currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return v.toFixed(2);
  }
}

export function savingsPercent(yearly: Plan, monthly: Plan): number {
  if (monthly.price <= 0) return 0;
  return Math.round((1 - yearly.price / (monthly.price * 12)) * 100);
}
