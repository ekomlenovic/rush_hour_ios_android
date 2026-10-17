// Feature graphic (1024 × 500) and 512 × 512 icon, from the app icon and two real boards.
// Usage: node store-listing/tools/feature.mjs (after capture.mjs)
import fs from 'fs';
import { fileURLToPath } from 'url';
import { launchBrowser } from './browser.mjs';

const TOOLS = fileURLToPath(new URL('./', import.meta.url));
const OUT = fileURLToPath(new URL('../', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TAGLINES = { en: 'Slide. Think. Escape.', fr: 'Glisse. Réfléchis. Évade-toi.' };

const browser = await launchBrowser(['--allow-file-access-from-files']);
const dataUrl = f => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;

// Icon: the adaptive icon layers flattened, as Google applies its own mask
const icon = await browser.newPage({ viewport: { width: 512, height: 512 } });
await icon.setContent(`<body style="margin:0"><div style="position:relative;width:512px;height:512px">
  <img src="${dataUrl(`${ROOT}assets/android-icon-background.png`)}" style="position:absolute;width:512px">
  <img src="${dataUrl(`${ROOT}assets/android-icon-foreground.png`)}" style="position:absolute;width:512px"></div></body>`);
await icon.screenshot({ path: `${OUT}icon-512.png` });
fs.copyFileSync(`${OUT}icon-512.png`, `${TOOLS}.raw/icon.png`);

// Boards cropped from the phone screenshots (game board: 20,207 → 392,579 in CSS pixels, scale 2.62)
const crop = await browser.newPage({ viewport: { width: 975, height: 975 } });
for (const [src, out] of [['phone/en-light/midgame', 'board'], ['phone/en-dark/daily', 'board2']]) {
  await crop.setContent(`<body style="margin:0;overflow:hidden"><img src="${dataUrl(`${TOOLS}.raw/${src}.png`)}" style="margin:${-207 * 2.62}px 0 0 ${-20 * 2.62}px"></body>`);
  await crop.screenshot({ path: `${TOOLS}.raw/${out}.png`, omitBackground: true });
}

const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
for (const [lang, tagline] of Object.entries(TAGLINES)) {
  await page.goto(`file://${TOOLS}feature.html?t=${encodeURIComponent(tagline)}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}${lang}/feature-graphic.png` });
}
await browser.close();
