// Daily Ham service worker: network-first for the app shell (so pushes go live
// immediately), cache-first for hashed static assets, network-only for API.
//
// VARIANT SEPARATION — the public app and the owner console share one origin
// but must NEVER share a shell. The old worker precached BOTH shells
// ("/" and "/owner") into one cache, so a stale or merged install could serve
// the owner shell — and its OWNER splash — on a public visit. This version
// keeps the two variants strictly apart:
//   - The public shell and hashed assets live in the public cache.
//   - The owner shell is NEVER cached: the private console always loads from
//     the network, so no cached owner page can ever leak onto the public side.
//   - Public navigations fall back ONLY to the cached public shell.
//   - Owner navigations are network-only; offline, the console simply fails
//     to load instead of ever showing the wrong variant.
// Cache version bumped so every phone drops the old mixed cache on next open.
const CACHE = "daily-ham-public-v1";
const SHELL = ["/", "/index.html", "/manifest.json"];

const isOwnerPath = (pathname) => pathname === "/owner" || pathname.startsWith("/owner/");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  // API calls always go to the network (fresh odds and stats).
  if (url.pathname.startsWith("/api/")) return;
  // Owner console: network-only. Never read from, and never write to, the
  // public cache — an owner page must not exist in any cache the public
  // app can fall back to.
  if (isOwnerPath(url.pathname)) return;
  const isShell = url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/manifest.json";
  if (isShell || event.request.mode === "navigate") {
    // Network-first: fresh HTML on every visit, cache as offline fallback.
    // The fallback is ONLY the public shell — never a cached owner page.
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match("/index.html"))
    );
    return;
  }
  // Hashed assets are immutable and variant-neutral (the variant is decided
  // by the HTML shell, not the bundle): cache-first.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
