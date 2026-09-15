/* Wavelength service worker — caches the app shell, icons and manifest so
   the UI launches offline / as an installed app. Firebase Auth, Realtime
   Database and all WebRTC traffic always go straight to the network. */

const CACHE_NAME = "wavelength-shell-v2";
const SHELL_ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/icon-192-maskable.png", "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./icons/favicon-16.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Only same-origin GET shell assets are intercepted; Firebase, the CDN SDK
// and anything else pass straight through to the network.
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isShell = url.pathname === "/" ||
    ["/index.html", "/manifest.webmanifest", "/sw.js"].includes(url.pathname) ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith("/index.html");

  if (!isShell) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
