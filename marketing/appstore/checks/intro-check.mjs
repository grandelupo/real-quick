// Screenshots the mascot intro at a few moments after the home page mounts.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/Users/karol/src/video-generator/node_modules/playwright');

const out = process.env.OUT ?? '/tmp/rq-checks';
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
  delete s.introDay;
  localStorage.setItem(key, JSON.stringify(s));
});
await page.reload({ waitUntil: 'commit' });
const t0 = Date.now();
for (let i = 0; i < 20; i++) {
  const ms = 400 + i * 220;
  const wait = t0 + ms - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/intro-${i}.png`, clip: { x: 60, y: 110, width: 282, height: 282 } });
}
await browser.close();
console.log('ok');
