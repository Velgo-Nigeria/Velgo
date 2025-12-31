
const CACHE_NAME = 'velgo-v1.0.3';
const DYNAMIC_CACHE = 'velgo-api-v1';

// Assets to pre-cache immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/manifest.json'
];

self.addEventListener('install', (event) => { 
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy 1: Network First, Fallback to Cache for Supabase API GET requests
  // We use Network First here so users always see the latest profile/job data.
  // Stale-While-Revalidate caused issues where edits wouldn't appear immediately.
  if (url.href.includes('supabase.co') && event.request.method === 'GET' && !url.href.includes('/auth/v1/')) {
      event.respondWith(
          fetch(event.request).then((networkResponse) => {
              return caches.open(DYNAMIC_CACHE).then((cache) => {
                  cache.put(event.request, networkResponse.clone());
                  return networkResponse;
              });
          }).catch(() => {
              // If offline, return the cached data
              return caches.match(event.request).then(response => {
                  // Fallback to prevent "Failed to fetch" crash if nothing in cache
                  return response || new Response(JSON.stringify({ error: 'Offline', data: [] }), { 
                      status: 200, 
                      headers: { 'Content-Type': 'application/json' } 
                  });
              });
          })
      );
      return;
  }

  // Strategy 2: Network First, Fallback to Cache for document/HTML (Navigation)
  if (event.request.mode === 'navigate') {
      event.respondWith(
          fetch(event.request).catch(() => {
              return caches.match('/index.html');
          })
      );
      return;
  }

  // Strategy 3: Cache First, Fallback to Network for everything else (Scripts, Styles, Images)
  if (event.request.method === 'GET') {
      event.respondWith(
          caches.match(event.request).then((response) => {
              return response || fetch(event.request).then((networkResponse) => {
                   return caches.open(CACHE_NAME).then((cache) => {
                       // Don't cache chrome-extension schemes or non-http
                       if (url.protocol.startsWith('http')) {
                            cache.put(event.request, networkResponse.clone());
                       }
                       return networkResponse;
                   });
              }).catch(() => {
                  // If image fails, return nothing (or a placeholder if you had one)
                  return new Response('', { status: 404 });
              });
          })
      );
  }
});
