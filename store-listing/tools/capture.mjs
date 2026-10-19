// Raw screenshots of the web build with the demo save, for every language, theme and device.
// Usage: node store-listing/tools/capture.mjs [--url http://localhost:8081] [--only phone|tablet7|tablet10]
// Output: store-listing/tools/.raw/<device>/<lang>-<scheme>/<screen>.png
import fs from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { buildSeed } from './seed.mjs';
import { launchBrowser } from './browser.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RAW = fileURLToPath(new URL('.raw/', import.meta.url));
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const BASE = arg('url', 'http://localhost:8081');
const ONLY = arg('only');

export const DEVICES = {
  phone: { viewport: { width: 412, height: 892 }, deviceScaleFactor: 2.62 },
  tablet7: { viewport: { width: 600, height: 960 }, deviceScaleFactor: 2 },
  tablet10: { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2 },
};
const SERIES = [['en', 'light'], ['fr', 'light'], ['en', 'dark'], ['fr', 'dark']];
const LEVEL = 73; // next level of the demo save
const LOCALES = { en: 'en-US', fr: 'fr-FR' };

const solution = JSON.parse(execFileSync('npx', ['tsx', `${ROOT}store-listing/tools/solve.ts`, String(LEVEL)], { cwd: ROOT, encoding: 'utf8' }));

function strings(lang) {
  const j = JSON.parse(fs.readFileSync(`${ROOT}locales/${lang}.json`, 'utf8'));
  return {
    level: j.home.play_level.replace('{{level}}', LEVEL),
    daily: j.home.daily_challenge,
    edit: j.common.edit,
    share: j.game.share,
    wood: j.cosmetics.board.wood,
  };
}

const visibleText = (p, text) => p.getByText(text, { exact: true }).filter({ visible: true }).first();

/** The board: the largest square element of the game screen */
async function boardBox(p) {
  return p.evaluate(() => {
    let best = null;
    for (const d of document.querySelectorAll('div')) {
      const r = d.getBoundingClientRect();
      if (r.width > 200 && r.width <= window.innerWidth && Math.abs(r.width - r.height) < 3 && (!best || r.width > best.width)) best = r;
    }
    return best && { x: best.x, y: best.y, size: best.width };
  });
}

/** Plays the first `count` moves of the optimal solution by dragging the vehicles */
async function play(p, count) {
  const b = await boardBox(p);
  const cell = b.size / solution.gridSize;
  const at = (row, col) => [b.x + (col + 0.5) * cell, b.y + (row + 0.5) * cell];
  for (const [r0, c0, r1, c1] of solution.moves.slice(0, count)) {
    const [x1, y1] = at(r0, c0), [x2, y2] = at(r1, c1);
    await p.mouse.move(x1, y1);
    await p.mouse.down();
    await p.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 6 });
    await p.mouse.move(x2, y2, { steps: 6 });
    await p.waitForTimeout(80);
    await p.mouse.up();
    await p.waitForTimeout(450);
  }
}

const SCREENS = {
  home: async () => {},
  map: async (p, s) => { await visibleText(p, s.level).click(); await p.waitForTimeout(2500); },
  midgame: async (p, s) => { await SCREENS.map(p, s); await visibleText(p, String(LEVEL)).click(); await p.waitForTimeout(3000); await play(p, 8); },
  win: async (p, s) => { await SCREENS.map(p, s); await visibleText(p, String(LEVEL)).click(); await p.waitForTimeout(3000); await play(p, solution.moves.length); await p.waitForTimeout(2500); },
  daily: async (p, s) => { await visibleText(p, s.daily).click(); await p.waitForTimeout(8000); },
  profile: '/profile',
  garage: ['/garage', async (p, s) => { await visibleText(p, s.wood).click(); await p.waitForTimeout(1500); }],
  creator: ['/custom-levels', async (p, s) => { await p.locator(`[aria-label^="${s.edit}, "]`).first().click(); await p.waitForTimeout(2500); }],
  share: ['/custom-levels', async (p, s) => { await p.locator(`[aria-label^="${s.share}, "]`).first().click(); await p.waitForTimeout(2500); }],
  multi: '/multi',
};

const browser = await launchBrowser();
for (const [device, config] of Object.entries(DEVICES)) {
  if (ONLY && ONLY !== device) continue;
  for (const [lang, scheme] of SERIES) {
    const out = `${RAW}${device}/${lang}-${scheme}`;
    fs.mkdirSync(out, { recursive: true });
    const seed = buildSeed({ scheme, lang });
    const s = strings(lang);
    const queue = Object.entries(SCREENS);
    const worker = async () => { for (let job; (job = queue.shift());) await shoot(...job); };
    const shoot = async (name, screen) => {
      const [path, steps] = typeof screen === 'string' ? [screen, null] : Array.isArray(screen) ? screen : ['/', screen];
      const ctx = await browser.newContext({ ...config, colorScheme: scheme, locale: LOCALES[lang] });
      await ctx.addInitScript(seed => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.clear();
          localStorage.setItem('rush-hour-storage', seed);
          sessionStorage.setItem('seeded', '1');
        }
      }, seed);
      const p = await ctx.newPage();
      try {
        await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 120000 });
        await p.waitForTimeout(3000);
        if (steps) await steps(p, s);
        await p.screenshot({ path: `${out}/${name}.png` });
      } catch (e) {
        console.error(`${device} ${lang}-${scheme} ${name}: ${e.message.split('\n')[0]}`);
      }
      await ctx.close();
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    console.log(`${device} ${lang}-${scheme} done`);
  }
}
await browser.close();
