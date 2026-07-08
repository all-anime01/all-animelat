// ============================================================================
//  SERVICE WORKER  —  All-Anime PWA
//  Estrategia: NETWORK-FIRST para todo lo del propio origen (así online SIEMPRE
//  se ve el contenido más reciente, sin caché rancia) y la caché solo actúa
//  como respaldo cuando NO hay conexión. No intercepta orígenes externos
//  (Firestore, gstatic, YouTube, geojs…), que van directo a la red.
// ============================================================================

const CACHE = "all-anime-v1";
// URLs "limpias" (cleanUrls en Firebase Hosting): sin .html para no redirigir.
const SHELL = ["/", "/offline", "/css/index-css.css", "/image/logo.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Solo gestionamos el propio origen; lo demás va directo a la red.
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // No cachea respuestas redirigidas (rompen la navegación desde caché).
        if (res && res.ok && !res.redirected) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((c) => c || (req.mode === "navigate" ? caches.match("/offline") : Response.error()))
      )
  );
});
