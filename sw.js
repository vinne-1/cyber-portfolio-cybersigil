var CACHE_NAME = 'vineet-portfolio-cybersigil-v11';
var ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './og-image.png',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
  'https://unpkg.com/lenis@1.1.18/dist/lenis.min.js',
  'https://unpkg.com/splitting@1.0.6/dist/splitting.min.js'
];

// Local assets that should always use network-first
function isLocalAsset(url) {
  return /\/(index\.html|style\.css|app\.js)/.test(url);
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  // SPA navigation: always serve index.html (no 404.html round-trip)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(function (cached) {
        // Refresh index.html cache in background
        var fetchPromise = fetch(self.registration.scope)
          .then(function (response) {
            if (response.ok) {
              var clone = response.clone();
              caches.open(CACHE_NAME).then(function (cache) {
                cache.put('./index.html', clone);
              });
            }
            return response;
          }).catch(function () { return cached; });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Local assets: network-first (always get latest app.js, style.css)
  if (isLocalAsset(e.request.url)) {
    e.respondWith(
      fetch(e.request).then(function (response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(e.request);
      })
    );
    return;
  }

  // CDN assets: cache-first (versioned URLs, safe to cache)
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
    })
  );
});
