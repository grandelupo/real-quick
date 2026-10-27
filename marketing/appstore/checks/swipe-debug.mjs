import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/Users/karol/src/video-generator/node_modules/playwright');
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
page.on('console', (m) => { const t = m.text(); if (/roll|swipe|Worklets|Error/i.test(t)) console.log('console:', t.slice(0, 160)); });
await page.goto('http://localhost:8083', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.evaluate(() => { const k='realquick.v1'; const s=JSON.parse(localStorage.getItem(k)||'{}'); s.onboarded=true; s.firstDay='2026-10-20'; const d=new Date(); s.introDay=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; localStorage.setItem(k, JSON.stringify(s)); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
const title = async () => (await page.evaluate(() => document.querySelector('[role="heading"]')?.textContent)) ?? '?';
console.log('start:', await title());
for (let i = 0; i < 3; i++) {
  await page.mouse.move(200, 600); await page.mouse.down();
  for (let y = 600; y >= 250; y -= 14) { await page.mouse.move(200, y); await page.waitForTimeout(12); }
  await page.mouse.up();
  await page.waitForTimeout(3000);
  console.log(`after swipe ${i + 1}:`, await title());
}
await browser.close();
