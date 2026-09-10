// sw.js — offline app shell. Cache-first so the app opens instantly with no signal.
// Bump VERSION on every deploy that changes a cached file; the old cache is dropped
// on activate and the open page reloads itself once (see app.js).
const VERSION = 'v3';
const CACHE = `printcalc-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/win98.css',
  './css/app.css',
  './js/app.js',
  './js/core/layout.js',
  './js/core/measure.js',
  './js/core/scores.js',
  './js/core/sequence.js',
  './js/ui/advancedInputs.js',
  './js/ui/dom.js',
  './js/ui/foldInputs.js',
  './js/ui/format.js',
  './js/ui/presets.js',
  './js/ui/scoresView.js',
  './js/ui/sequenceView.js',
  './js/ui/sheetView.js',
  './js/ui/sizeInputs.js',
  './js/ui/summaryView.js',
  './assets/favicon.ico',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // CacheStorage is per-origin: on GitHub Pages every project page of this
      // account shares one origin, so only ever delete our own stale versions.
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('printcalc-') && key !== CACHE).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)),
  );
});
