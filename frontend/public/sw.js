// Service worker for Horário Trabalho — offline-first PWA shell.
//
// Strategy:
//  • Network-first for navigation requests (index.html, /, manifest.json)
//    so users always pick up new deploys without manual refresh.
//  • Cache-first for hashed static assets (CRA emits files like
//    main.abc123.js — once cached they're stable and cheap to keep).
//  • The pdf.worker.min.mjs is treated as a static asset and cached.
//  • Bumping CACHE invalidates everything from the previous version.
const CACHE = "fazes-v3";
const CORE = ["/", "/index.html", "/manifest.json", "/pdf.worker.min.mjs"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Allow the page to instruct the SW to take over immediately.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isNavigation(req) {
  return (
    req.mode === "navigate" ||
    (req.method === "GET" &&
      req.headers.get("accept") &&
      req.headers.get("accept").includes("text/html"))
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Never cache cross-origin (e.g. analytics, posthog) or API requests
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Network-first for the app shell so users get fresh JS bundles after deploys.
  if (
    isNavigation(req) ||
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname === "/manifest.json"
  ) {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.ok && resp.type === "basic") {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return resp;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/index.html")))
    );
    return;
  }

  // Cache-first for everything else (hashed JS/CSS, images, fonts, pdf.worker)
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((resp) => {
            if (resp && resp.ok && resp.type === "basic") {
              const copy = resp.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return resp;
          })
          .catch(() => cached)
    )
  );
});
