// Finishes the web export for GitHub Pages (see docs/GAME_DESIGN.md, Version web):
//   node scripts/web/postExport.mjs <dist>
// - 404.html: GitHub Pages serves it for any path it does not know, so a link straight to a
//   screen (/game?data=…) still opens the app, whose router reads the address;
// - sw.js: the service worker, which keeps the game for offline play. Its cache is named after
//   the content of the files: a new export replaces it, an unchanged one keeps it.
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const BASE = '/rush_hour_ios_android/';

copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));

const files = [];
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(relative(dist, path).split(sep).join('/'));
  }
};
walk(dist);

// Downloaded at the install: everything but the music (cached once played) and what the worker is not for
const skipped = /(^|\/)(404\.html|sw\.js|metadata\.json|\.nojekyll)$|\.mp3$/;
const precache = files.filter(f => !skipped.test(f)).sort();
const hash = createHash('sha256');
for (const file of precache) hash.update(file).update(readFileSync(join(dist, file)));
const version = hash.digest('hex').slice(0, 12);

const worker = `// Written by scripts/web/postExport.mjs: do not edit
const BASE = ${JSON.stringify(BASE)};
const CACHE = 'rush-hours-${version}';
const PRECACHE = ${JSON.stringify(precache.map(f => (f === 'index.html' ? '' : f)))};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE.map(f => BASE + f))).then(() => self.skipWaiting()));
});

// The previous version stays one more time: a page opened before the update can still load its screens
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('rush-hours-') && name !== CACHE);
    for (const name of names.slice(0, -1)) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  // A screen: the latest version online, the one kept offline
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(BASE, { cacheName: CACHE })) ?? caches.match(BASE)));
    return;
  }

  // Files named after their content: kept ones never change
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  })());
});
`;
writeFileSync(join(dist, 'sw.js'), worker);
console.log(`web export finished: 404.html, sw.js (${precache.length} files, cache ${version})`);
