// Store screenshots: a headline above a real screenshot in a device frame (frame.html + specs.json).
// Usage: node store-listing/tools/render.mjs (after capture.mjs)
// Output: store-listing/<lang>/{phone,tablet-7,tablet-10}/<name>.png
import fs from 'fs';
import { fileURLToPath } from 'url';
import { launchBrowser } from './browser.mjs';

const TOOLS = fileURLToPath(new URL('./', import.meta.url));
const OUT = fileURLToPath(new URL('../', import.meta.url));
// The layout is 1080 × 1920 (9:16); the scale gives the final size
const TARGETS = [
  { raw: 'phone', dir: 'phone', device: 'phone', scale: 1 },          // 1080 × 1920
  { raw: 'tablet7', dir: 'tablet-7', device: 'tablet', scale: 1 },     // 1080 × 1920
  { raw: 'tablet10', dir: 'tablet-10', device: 'tablet', scale: 4 / 3 }, // 1440 × 2560
];
const only = process.argv[2];
const specs = JSON.parse(fs.readFileSync(`${TOOLS}specs.json`, 'utf8'));
const browser = await launchBrowser(['--allow-file-access-from-files']);
for (const t of TARGETS) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: t.scale });
  for (const [lang, list] of Object.entries(specs)) {
    fs.mkdirSync(`${OUT}${lang}/${t.dir}`, { recursive: true });
    for (const [name, h, s, imgs] of list) {
      if (only && !name.startsWith(only)) continue;
      const img = imgs.split('|').map(i => `.raw/${t.raw}/${i}.png`).join('|');
      await page.goto(`file://${TOOLS}frame.html?` + new URLSearchParams({ h, s, img, device: t.device }));
      await page.waitForLoadState('load');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}${lang}/${t.dir}/${name}.png` });
    }
  }
  await page.close();
}
await browser.close();
