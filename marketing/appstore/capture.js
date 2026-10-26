// Capture pass for store screenshots — runs the real app (web build of the
// same React Native code) with demo records seeded into its own storage
// format, at the 6.9" iPhone logical size (440×956 @3x → 1320×2868).
//
//   cd app && EXPO_PUBLIC_MOCK_PRODUCTS=1 npx expo start --web --port 8081
//   node marketing/appstore/capture.js            # writes raw/en-US + raw/ja
//
// Needs Playwright (preinstalled in cloud sessions; `npm i -g playwright` locally).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const URL = process.env.APP_URL || 'http://localhost:8081';
const OUT = path.join(__dirname, 'raw');
const W = 440, H = 956, STATUS = 54; // the composer draws the 9:41 status bar strip

const it = (name, emoji, grams, kcal, p, c, f) => ({ name, emoji, grams, kcal, protein: p, carbs: c, fat: f });
const DEMO = {
  'en-US': {
    names: {
      breakfast: ['Avocado toast', [it('Sourdough toast', '🍞', 70, 180, 6, 33, 2), it('Avocado', '🥑', 70, 112, 1.4, 6, 10), it('Poached egg', '🥚', 50, 72, 6.3, 0.4, 4.8)]],
      coffee: ['Flat white', [it('Flat white', '☕', 240, 110, 6, 9, 5)]],
      lunch: ['Salmon poke bowl', [it('Salmon', '🐟', 120, 250, 24, 0, 16), it('Sushi rice', '🍚', 180, 260, 4.6, 57, 0.5), it('Edamame', '🫛', 60, 73, 6.5, 5, 3)]],
      snack: ['Greek yogurt & berries', [it('Greek yogurt', '🥛', 170, 100, 17, 6, 0.7), it('Blueberries', '🫐', 60, 34, 0.4, 9, 0.2)]],
      yesterday: ['Margherita pizza', [it('Margherita pizza', '🍕', 300, 780, 33, 96, 28)]],
    },
  },
  ja: {
    names: {
      breakfast: ['朝ごはん', [it('ご飯', '🍚', 160, 250, 4.3, 56, 0.5), it('焼き鮭', '🐟', 80, 170, 18, 0, 10), it('味噌汁', '🥣', 200, 40, 3, 4, 1.3)]],
      coffee: ['カフェラテ', [it('カフェラテ', '☕', 300, 160, 9, 13, 7)]],
      lunch: ['サーモン丼', [it('サーモン', '🐟', 120, 250, 24, 0, 16), it('酢飯', '🍚', 180, 260, 4.6, 57, 0.5), it('枝豆', '🫛', 60, 73, 6.5, 5, 3)]],
      snack: ['ヨーグルト', [it('ヨーグルト', '🥛', 170, 100, 17, 6, 0.7), it('ブルーベリー', '🫐', 60, 34, 0.4, 9, 0.2)]],
      yesterday: ['マルゲリータ', [it('マルゲリータ', '🍕', 300, 780, 33, 96, 28)]],
    },
  },
};

function state(locale) {
  const n = DEMO[locale].names;
  const e = (id, day, hm, key) => ({
    id, createdAt: new Date(`${day}T${hm}:00`).getTime(), dayKey: day, source: 'photo', status: 'ready',
    items: n[key][1], title: n[key][0], multiplier: 1, scale: 1, attempts: 1,
  });
  return {
    onboarded: true,
    settings: { goalKcal: 2000, bias: 'over', unit: 'kcal', partnerName: '', nightLook: true, haptics: true, imperial: false },
    entries: [
      e('a', '2026-10-26', '08:05', 'breakfast'), e('b', '2026-10-26', '10:30', 'coffee'),
      e('c', '2026-10-26', '13:10', 'lunch'), e('d', '2026-10-26', '16:20', 'snack'),
      e('y', '2026-10-25', '19:30', 'yesterday'),
    ],
    totalSnaps: 2, buttonResetAt: 0, isPro: false,
    installId: '5f0c8d1e-1111-4222-8333-000000000001', firstDay: '2026-10-01',
  };
}

async function page(browser, locale, hour) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H - STATUS }, deviceScaleFactor: 3, locale });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date(2026, 9, 26, hour, 41) });
  await p.clock.resume();
  await p.goto(URL, { timeout: 240000 });
  // Let the first load finish writing its defaults before seeding, or it overwrites ours.
  await p.waitForTimeout(2500);
  await p.evaluate((s) => localStorage.setItem('realquick.v1', s), JSON.stringify(state(locale)));
  await p.reload();
  await p.waitForTimeout(4500);
  return p;
}

(async () => {
  // Locally the bundled Chromium is often stale: PW_CHANNEL=chrome uses the installed Chrome.
  const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  for (const locale of ['en-US', 'ja']) {
    const dir = path.join(OUT, locale);
    fs.mkdirSync(dir, { recursive: true });
    const shot = (p, name) => p.screenshot({ path: path.join(dir, name) });

    let p = await page(browser, locale, 17);
    await shot(p, '01-home.png');
    await p.getByTestId('notes-tab').click();
    await p.waitForTimeout(1000);
    await shot(p, '02-notes.png');
    await p.close();

    p = await page(browser, locale, 17);
    await p.evaluate((h) => {
      const el = [...document.querySelectorAll('div')].find((d) => { const s = getComputedStyle(d); return (s.overflowY === 'scroll' || s.overflowY === 'auto') && d.scrollHeight > d.clientHeight + 100; });
      el.scrollTop = el.clientHeight; el.dispatchEvent(new Event('scroll'));
    });
    await p.waitForTimeout(1800);
    await shot(p, '03-yesterday.png');
    await p.close();

    p = await page(browser, locale, 21);
    await shot(p, '04-night.png');
    await p.getByTestId('settings-button').click();
    await p.waitForTimeout(1200);
    await shot(p, '05-settings.png');
    await p.close();

    // Subscription review screenshot: the populated paywall, mock products
    // mirroring RealQuick.storekit (APP-STORE.md §2). Raw, no frame.
    if (locale === 'en-US') {
      p = await page(browser, locale, 17);
      await p.getByTestId('settings-button').click();
      await p.waitForTimeout(900);
      await p.getByText('Go unlimited').click();
      await p.waitForTimeout(1600);
      const text = await p.textContent('body');
      if (!/You won't be charged today/.test(text) || !/1 week free, then \$29\.99\/year/.test(text)) throw new Error('paywall copy missing');
      await p.screenshot({ path: path.join(__dirname, 'subscription-review.png') });
      await p.close();
    }
    console.log('captured', locale);
  }
  await browser.close();
})();
