// Web-build checks: the plain paywall, the month sheet, and the rubber band
// at the newest day.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/Users/karol/src/video-generator/node_modules/playwright');

const out = process.env.OUT ?? '/tmp/rq-checks';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
page.on('console', (m) => /Error|Warning: /.test(m.text()) && console.log('console:', m.text().slice(0, 200)));
await page.goto('http://localhost:8083', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const k = 'realquick.v1';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  const d = new Date();
  const key = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  s.onboarded = true;
  s.firstDay = '2026-10-01';
  s.introDay = key(d);
  s.isPro = false;
  s.entries = [];
  for (let back = 0; back < 20; back++) {
    const dd = new Date(d.getTime() - back * 86400000);
    const kcal = 1200 + ((back * 397) % 1300);
    s.entries.push({ id: 'seed' + back, createdAt: dd.getTime(), dayKey: key(dd), source: 'text', status: 'ready', multiplier: 1, scale: 1, attempts: 1, title: 'Seed', text: 'seed', items: [{ name: 'seed', emoji: '', grams: 400, kcal, protein: 60, carbs: 120, fat: 30 }] });
  }
  localStorage.setItem(k, JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(6000);

// 1. the paywall (the free days are long over, so the snap button opens it)
await page.getByTestId('snap-button').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/ui-paywall.png` });
await page.getByTestId('coupon-link').click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/ui-paywall-coupon.png` });
await page.keyboard.press('Escape');
await page.mouse.click(200, 40);
await page.waitForTimeout(800);

// 2. the month sheet from the date
await page.getByTestId('date-button').click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/ui-month.png` });
await page.mouse.click(200, 40);
await page.waitForTimeout(800);

// 3. rubber band: pull down on today, shoot mid-pull
await page.mouse.move(200, 400);
await page.mouse.down();
for (let y = 400; y <= 560; y += 10) {
  await page.mouse.move(200, y);
  await page.waitForTimeout(12);
}
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/ui-rubber.png` });
await page.mouse.up();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/ui-rubber-back.png` });
await browser.close();
console.log('ok');
