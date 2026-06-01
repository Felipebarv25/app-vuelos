// Service Worker mínimo: hace que la app abra rápido y funcione como app
// instalada. Estrategia "network-first" para HTML (siempre lo más nuevo) y
// caché para los recursos estáticos (mapa, iconos, etc.).
const CACHE = "viajero360-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Solo GET; nunca cacheamos las APIs de datos (siempre frescas).
  if (req.method !== "GET" || req.url.includes("/api/")) return;

  // Recursos estáticos: caché primero (rápido).
  if (/\.(png|svg|css|js|woff2?|json)$/.test(new URL(req.url).pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
            return res;
          })
      )
    );
    return;
  }

  // Páginas: red primero, con respaldo a caché si no hay internet.
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
