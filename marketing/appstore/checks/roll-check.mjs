// Opens the web build, skips onboarding, and screenshots the day roll mid-way
// and after it commits, so the planet pivot can be checked without a phone.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/Users/karol/src/video-generator/node_modules/playwright');

const out = process.argv[2] ?? '/tmp/rq-checks';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.goto('http://localhost:8083', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const key = 'realquick.v1';
  const raw = localStorage.getItem(key);
  const s = raw ? JSON.parse(raw) : {};
  s.onboarded = true;
  s.firstDay = '2026-10-20';
  localStorage.setItem(key, JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/roll-0.png` });

// swipe up slowly: hold the roll half-way, shoot, then finish it
const x = 200;
await page.mouse.move(x, 600);
await page.mouse.down();
for (let y = 600; y >= 470; y -= 10) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(16);
}
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/roll-half.png` });
for (let y = 470; y >= 300; y -= 10) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(16);
}
await page.mouse.up();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/roll-done.png` });
// and back down
await page.mouse.move(x, 300);
await page.mouse.down();
for (let y = 300; y <= 640; y += 10) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(16);
}
await page.mouse.up();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/roll-back.png` });
await browser.close();
console.log('ok');
