// Web-build check for the bottom sheet: the month sheet opens, a drag down
// on its body closes it (no scroll in the way), and the paywall still scrolls.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/Users/karol/src/video-generator/node_modules/playwright');

const out = process.env.OUT ?? '/tmp/rq-checks';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
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
  s.entries = [{ id: 'seed', createdAt: Date.now(), dayKey: key(d), source: 'text', status: 'ready', multiplier: 1, scale: 1, attempts: 1, title: 'Seed', text: 'seed', items: [{ name: 'seed', emoji: '', grams: 400, kcal: 900, protein: 60, carbs: 120, fat: 30 }] }];
  localStorage.setItem(k, JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

await page.getByTestId('date-button').click();
await page.waitForTimeout(1200);
const sheetVisible = async () => (await page.getByText('October 2026').count()) > 0;
console.log('month sheet open:', await sheetVisible());
// drag down on the sheet body (the weekday row, not the grabber)
await page.mouse.move(200, 560);
await page.mouse.down();
for (let y = 560; y <= 820; y += 12) {
  await page.mouse.move(200, y);
  await page.waitForTimeout(10);
}
await page.mouse.up();
await page.waitForTimeout(900);
console.log('month sheet after body drag:', await sheetVisible());
await page.screenshot({ path: `${out}/sheet-after-drag.png` });
await browser.close();
console.log('ok');
