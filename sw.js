// Smilebook offline cache: the page always comes from the web when there is connection (so a reload is always
// the latest version) and from this cache when offline; a new version takes over at once
const CACHE = 'smilebook-1.6.0-1794611311972', SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
// a new version installs alongside the old one and waits; the page shows "Actualizar" and asks it to take over
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting())); });
self.addEventListener('message', e => { if (e.data?.type === 'skip-waiting') self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // never cache Microsoft sign-in or OneDrive traffic
  if (/login\.microsoftonline\.com|graph\.microsoft\.com|login\.live\.com/.test(u.host)) return;
  const same = u.origin === location.origin, font = /fonts\.(googleapis|gstatic)\.com/.test(u.host);
  if (!same && !font) return;
  // the page: network first (fresh version on every load), cache only as the offline fallback
  if (same && (e.request.mode === 'navigate' || /\/$|index\.html$/.test(u.pathname))){
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await Promise.race([fetch(e.request, {cache: 'no-cache'}), new Promise((_, rej) => setTimeout(() => rej(new Error('lenta')), 6000))]);
        if (r.ok) c.put('index.html', r.clone());
        return r;
      } catch { return (await c.match('index.html')) || (await c.match(e.request, {ignoreSearch: true})) || Response.error(); }
    })());
    return;
  }
  // icons, manifest, fonts: from cache, refreshed in the background
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, {ignoreSearch: same});
    if (hit && same) return hit;
    const net = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
