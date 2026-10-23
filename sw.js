// Lets OI1 open without internet once it has been visited.
// Network first, so updates show up right away; the cache is the fallback.
const CACHE = 'oi1-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'shell/shell.css', 'shell/shell.js', 'shell/modules.js',
  'modules/letter/index.js', 'icons/icon.svg', 'icons/icon-192.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request))
  );
});
