// public/sw.js
// Minimal service worker: keeps a copy of the app files so the installed app opens quickly
// and can show its shell when offline. It NEVER caches /api/* requests: data always comes
// from the server (online-first).
// Icons and fonts are cached first; all other files are fetched from the network first,
// so updates show up immediately. Bump CACHE_VERSION if you change icons or fonts.

const CACHE_VERSION = "v2";
const CACHE = "ledger-shell-" + CACHE_VERSION;

const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/css/app.css",
  "/js/app.js",
  "/js/api.js",
  "/js/util.js",
  "/js/auth-view.js",
  "/js/products.js",
  "/js/parties.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/fonts/Vazirmatn-Regular.woff2",
  "/fonts/Vazirmatn-Bold.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(pathname) {
  return pathname.startsWith("/icons/") || pathname.startsWith("/fonts/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never touch API calls

  // Icons and fonts never change without a new CACHE_VERSION: cache first.
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Everything else (pages, scripts, styles): network first, cached copy only when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          const key = req.mode === "navigate" ? "/" : req;
          caches.open(CACHE).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === "navigate" ? "/" : req))
  );
});
