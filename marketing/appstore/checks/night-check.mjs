// Renders the home page at 21:30 (night look on) and at noon on the web build.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/Users/karol/src/video-generator/node_modules/playwright');
const out = process.env.OUT ?? '/tmp/rq-checks';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
for (const [name, hour] of [['night', 21], ['day', 12]]) {
  const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await page.clock.install({ time: new Date(2026, 9, 27, hour, 30) });
  await page.clock.resume();
  await page.goto('http://localhost:8083', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const k='realquick.v1'; const s=JSON.parse(localStorage.getItem(k)||'{}'); s.onboarded=true; s.firstDay='2026-10-01'; s.introDay='2026-10-27'; s.settings = { ...(s.settings||{}), nightLook: true }; s.entries=[{ id:'seed', createdAt: Date.now(), dayKey:'2026-10-27', source:'text', status:'ready', multiplier:1, scale:1, attempts:1, title:'Seed', text:'seed', items:[{ name:'seed', emoji:'', grams:400, kcal:1600, protein:60, carbs:120, fat:30 }] }]; localStorage.setItem(k, JSON.stringify(s)); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
}
await browser.close();
console.log('ok');
