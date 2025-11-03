// sw.js — Harvest Q Stages 2,3 and 4
const VERSION = 'hq-stage3-v1';
const CACHE_SHELL = `hq-shell-${VERSION}`;
const CACHE_RUNTIME = `hq-rt-${VERSION}`;

// App shell to precache (same-origin, relative paths for GH Pages / Vercel)
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/index.js',          // ⬅️ new: Stage 3 front-end glue
  './logo.png',
  './manifest.webmanifest',
  './img/placeholder.png'   // used when crop image fails
];

// Delete old caches with our prefixes on activate
async function cleanOldCaches() {
  const keys = await caches.keys();
  const keep = new Set([CACHE_SHELL, CACHE_RUNTIME]);
  await Promise.all(
    keys.map(k => {
      const ours = k.startsWith('hq-shell-') || k.startsWith('hq-rt-');
      return (!keep.has(k) && ours) ? caches.delete(k) : Promise.resolve(true);
    })
  );
}

// Allow page to tell the SW to take over immediately
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then((c) => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    cleanOldCaches().then(() => self.clients.claim())
  );
});

// Caching strategy:
// - Navigations: network-first, fallback to cached index.html (offline SPA).
// - JSON (data/*.json, markets/*.json): network-first, fallback to cache.
// - Images: stale-while-revalidate, fallback to placeholder.
// - Static same-origin assets (CSS/JS/fonts): cache-first, then network.
// - Cross-origin (Leaflet CDN, etc.): network-first, fallback to cache.

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // 1) SPA navigations – keep offline UX smooth
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        // Cache a fresh copy of index for offline
        const cache = await caches.open(CACHE_RUNTIME);
        cache.put('./index.html', net.clone());
        return net;
      } catch {
        const cached = await caches.match('./index.html', { ignoreSearch: true });
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // 2) JSON (network-first): data/*.json, markets/*.json, etc.
  if (url.pathname.endsWith('.json')) {
    event.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(CACHE_RUNTIME);
        cache.put(req, net.clone());
        return net;
      } catch {
        const cached = await caches.match(req, { ignoreSearch: true });
        return cached || new Response('[]', { headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // 3) Images (stale-while-revalidate)
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_RUNTIME);
      const cached = await cache.match(req);
      const fetchAndUpdate = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) {
        // Refresh in background
        event.waitUntil(fetchAndUpdate);
        return cached;
      }
      const net = await fetchAndUpdate;
      if (net) return net;

      // Fallback placeholder
      const placeholder = await caches.match('./img/placeholder.png');
      return placeholder || new Response('', { status: 404 });
    })());
    return;
  }

  // 4) Same-origin assets (cache-first)
  if (isSameOrigin) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const net = await fetch(req);
        const cache = await caches.open(CACHE_RUNTIME);
        cache.put(req, net.clone());
        return net;
      } catch {
        // Last-chance fallback for navigations already covered above
        const fallback = await caches.match('./index.html', { ignoreSearch: true });
        return fallback || new Response('', { status: 503 });
      }
    })());
    return;
  }

  // 5) Cross-origin (Leaflet tiles, CDNs): network-first with cache fallback
  event.respondWith((async () => {
    try {
      const net = await fetch(req);
      if (net && net.ok && (net.type === 'basic' || net.type === 'cors')) {
        const cache = await caches.open(CACHE_RUNTIME);
        cache.put(req, net.clone());
      }
      return net;
    } catch {
      const cached = await caches.match(req);
      return cached || new Response('', { status: 503 });
    }
  })());
}); 
