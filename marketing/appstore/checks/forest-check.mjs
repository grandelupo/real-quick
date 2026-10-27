// Renders the forest band for today with a given intake (as a share of the
// 2,000 kcal goal), so growth and overgrowth can be looked at on the web build.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/Users/karol/src/video-generator/node_modules/playwright');

const out = process.env.OUT ?? '/tmp/rq-checks';
const shares = (process.argv[2] ?? '0.85').split(',').map(Number);
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.goto('http://localhost:8083', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
for (const share of shares) {
  await page.evaluate((share) => {
    const key = 'realquick.v1';
    const raw = localStorage.getItem(key);
    const s = raw ? JSON.parse(raw) : {};
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    s.onboarded = true;
    s.firstDay = '2026-10-20';
    s.introDay = day;
    const kcal = Math.round(2000 * share);
    s.entries = [];
    for (let back = 0; back < 7; back++) {
      const dd = new Date(d.getTime() - back * 86400000);
      const dk = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
      s.entries.push({ id: 'seed' + back, createdAt: dd.getTime(), dayKey: dk, source: 'text', status: 'ready', multiplier: 1, scale: 1, attempts: 1, title: 'Seed', text: 'seed',
        items: [{ name: 'seed', emoji: '', grams: 400, kcal, protein: kcal * 0.06, carbs: kcal * 0.12, fat: kcal * 0.03 }] });
    }
    localStorage.setItem(key, JSON.stringify(s));
  }, share);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${out}/forest-${Math.round(share * 100)}.png`, clip: { x: 0, y: 430, width: 402, height: 444 } });
  if (process.argv[3] === 'week') {
    for (let back = 1; back < 7; back++) {
      await page.mouse.move(200, 600);
      await page.mouse.down();
      for (let y = 600; y >= 250; y -= 14) { await page.mouse.move(200, y); await page.waitForTimeout(12); }
      await page.mouse.up();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${out}/forest-day${back}.png`, clip: { x: 0, y: 430, width: 402, height: 444 } });
    }
  }
}
await browser.close();
console.log('ok');
