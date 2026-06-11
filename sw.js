const CACHE = 'tonni-blast-v2';

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/Naal%20Nachna%20%28Lyrics%29%20-%20Dhurandhar%20%20Shashwat%20S%2C%20Afsana%20K%2C%20Rebel%2C%20Irshad%20K%20%20Ranveer%20S%2C%20Akshay%20K.mp3',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
