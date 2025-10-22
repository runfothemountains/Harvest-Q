// sw.js
const VERSION = 'hq-stage2-v3';
const CACHE_SHELL = `hq-shell-${VERSION}`;
const CACHE_RUNTIME = `hq-rt-${VERSION}`;

// App shell to precache (must be same-path URLs for GH Pages + Vercel)
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './logo.png',
  './manifest.webmanifest',
  // Optional: local placeholder used in app.js on image error
  './img/placeholder.png'
];

// Helper: delete all old caches with our prefixes
async function cleanOldCaches() {
  const keys = await caches.keys();
  const keep = new Set([CACHE_SHELL, CACHE_RUNTIME]);
  await Promise.all(keys.map(k => (!keep.has(k) && (k.startsWith('hq-shell-') || k.startsWith('hq-rt-'))) ? caches.delete(k) : null));
}

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

// Strategy notes
// - HTML navigations: Network-first, fallback to cached index.html (offline SPA).
// - JSON (your data/*.json): Network-first, fallback to cache.
// - Images: Stale-while-revalidate (fast on repeat visits), fallback to placeholder if available.
// - Everything else (CSS/JS): Cache-first (served from APP_SHELL), fall back to network.

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // 1) Handle SPA navigations cleanly (works on Vercel + GH Pages)
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try fresh page first
          const net = await fetch(req);
          // Optionally cache a copy of the main page for offline
          const copy = net.clone();
          const cache = await caches.open(CACHE_RUNTIME);
          cache.put('./index.html', copy);
          return net;
        } catch {
          // Offline fallback to cached shell
          const cached = await caches.match('./index.html', { ignoreSearch: true });
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // 2) JSON (network-first)
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req, { cache: 'no-store' });
          const copy = net.clone();
          const cache = await caches.open(CACHE_RUNTIME);
          cache.put(req, copy);
          return net;
        } catch {
          const cached = await caches.match(req, { ignoreSearch: true });
          return cached || new Response('[]', { headers: { 'Content-Type': 'application/json' } });
        }
      })()
    );
    return;
  }

  // 3) Images (stale-while-revalidate)
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_RUNTIME);
        const cached = await cache.match(req);
        const fetchAndUpdate = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => null);

        // Return cached immediately if present; kick off background refresh
        if (cached) {
          event.waitUntil(fetchAndUpdate);
          return cached;
        }

        // No cache — try network, then placeholder
        const net = await fetchAndUpdate;
        if (net) return net;

        // Fallback to placeholder if we have one
        const placeholder = await caches.match('./img/placeholder.png');
        return placeholder || new Response('', { status: 404 });
      })()
    );
    return;
  }

  // 4) Everything else
  // Same-origin assets from APP_SHELL: cache-first; otherwise network-first.
  if (isSameOrigin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const net = await fetch(req);
          // Optionally cache runtime assets too (CSS/JS/fonts not in shell)
          const cache = await caches.open(CACHE_RUNTIME);
          cache.put(req, net.clone());
          return net;
        } catch {
          // As a last resort, try index for same-origin navigations (already handled above)
          const fallback = await caches.match('./index.html', { ignoreSearch: true });
          return fallback || new Response('', { status: 503 });
        }
      })()
    );
    return;
  }

  // 5) Cross-origin (e.g., Leaflet CDN): network-first with cache fallback
  event.respondWith(
    (async () => {
      try {
        const net = await fetch(req);
        // Cache successful cross-origin responses for resilience
        if (net && net.ok && (net.type === 'basic' || net.type === 'cors')) {
          const cache = await caches.open(CACHE_RUNTIME);
          cache.put(req, net.clone());
        }
        return net;
      } catch {
        const cached = await caches.match(req);
        return cached || new Response('', { status: 503 });
      }
    })()
  );
});
