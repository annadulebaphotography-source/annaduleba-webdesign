const CACHE_VERSION = "anna-duleba-offline-v11";
const RUNTIME_CACHE = "anna-duleba-runtime-v11";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/angebot.html",
  "/preise.html",
  "/webdesign-karlsruhe.html",
  "/galerie.html",
  "/kontakt.html",
  "/ueber-mich.html",
  "/worum.html",
  "/impressum/",
  "/impressum/index.html",
  "/datenschutz/",
  "/datenschutz/index.html",
  "/offline.html",
  "/styles.css?v=legal-2",
  "/main.js?v=legal-4",
  "/content.js?v=local-first-4",
  "/firebase.js?v=firestore-longpoll-1",
  "/header.html?v=legal-1",
  "/footer.html?v=legal-1",
  "/logo-digital-atelier-cropped.png",
  "/hero-digital-atelier-banner-v3.png",
  "/favicon.svg",
  "/favicon-32x32.png",
  "/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => ![CACHE_VERSION, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const url = new URL(request.url);
    return (
      (await cache.match(request)) ||
      (await caches.match(request)) ||
      (await caches.match(url.pathname)) ||
      (await caches.match("/offline.html"))
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const cache = await caches.open(RUNTIME_CACHE);
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.origin === self.location.origin ||
    request.destination === "image" ||
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font"
  ) {
    event.respondWith(cacheFirst(request));
  }
});
