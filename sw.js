// sw.js — Service Worker Audit Kebersihan Tangan - RSU SHU
const CACHE_NAME = 'audit-hh-shu-v1';  // ← bump versi = cache lama otomatis dihapus
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logo_surya-removebg-preview.png'
];

// Install: cache aset statis baru
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate: hapus SEMUA cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Hapus cache lama:', k);
          return caches.delete(k);
        })
      )
    ).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch: network-first untuk HTML, cache-first untuk aset lain
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Panggilan ke Google Apps Script → selalu network
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ status: 'error', message: 'Offline - tidak dapat menghubungi server' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // index.html → network-first agar selalu dapat versi terbaru
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Aset statis lain → cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Terima perintah SKIP_WAITING dari halaman
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-audit') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE' }));
}
