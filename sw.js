const VERSION = 'hq-stage2-v1';
const CACHE = `hq-shell-${VERSION}`;
const OFFLINE = ['./','./index.html','./css/style.css','./js/app.js','./logo.png','./manifest.webmanifest'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(OFFLINE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch', e=>{
  if(e.request.method !== 'GET') return;
  // network-first for JSON, cache-first for app shell
  if(e.request.url.endsWith('.json')){
    e.respondWith(fetch(e.request).then(r=>{ const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r; }).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)));
});
